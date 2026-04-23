import { stripe } from '../services/stripe.service.js';
import prisma from '../services/prisma.service.js';
import config from '../config/index.js';
import * as vpsService from '../services/vps.service.js';

/**
 * Creates a Stripe Subscription (Elements Flow).
 * Returns clientSecret for the frontend to confirm payment.
 */
export const createSubscription = async (req, res, next) => {
  try {
    const { productId, hostname, sshKey, userPassword, osVersionId, billingCycle, locationId } = req.body;
    const userId = req.user.id; // From your auth middleware

    if (!['MONTHLY', 'QUARTERLY', 'ANNUALLY'].includes(billingCycle)) {
      return res.status(400).json({ message: 'Invalid billing cycle' });
    }

    // 1. Validate Product & Stock
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    if (product.stock !== -1 && product.stock <= 0) {
      return res.status(400).json({ message: 'This product is currently out of stock' });
    }

    // 2. Resolve Price Logic
    const initPrice = await prisma.productPrice.findFirst({
      where: {
        productId: product.id,
        billingCycle: billingCycle,
      }
    });

    if (!initPrice) {
      return res.status(400).json({ message: 'This billing cycle is not available for this product' });
    }

    // 3. Validate OS Selection
    // CRITICAL: Ensure the osVersionId sent from the frontend matches your DB UUID/Int
    const osVersion = await prisma.osVersion.findUnique({
      where: { id: osVersionId },
      include: { os: true }
    });

    if (!osVersion) {
      return res.status(400).json({ message: 'Invalid OS Version selected. Please refresh the page and try again.' });
    }

    // Calculate total price (Base Price + OS Premium)
    const finalAmount = Math.round((Number(initPrice.price) + Number(osVersion.premium || 0)) * 100);

    const locationRecord = await prisma.location.findUnique({
      where: { id: locationId }
    });

    if (!locationRecord) {
      return res.status(400).json({ message: 'Invalid location selected.' });
    }

    // Check if there is at least one AVAILABLE IP for this specific location
    const availableIp = await prisma.ipAddress.findFirst({
      where: {
        status: 'AVAILABLE',
        location: locationRecord.name
      }
    });

    if (!availableIp) {
      return res.status(400).json({ 
        message: `We are currently out of capacity in ${locationRecord.name}. Please select a different location.` 
      });
    }

    // 4. Get or Create Customer
    const user = await prisma.user.findUnique({ where: { id: userId } });
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId: user.id }
      });
      customerId = customer.id;
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    // 5. Determine Interval
    const intervalMap = {
      'MONTHLY': { interval: 'month', count: 1 },
      'QUARTERLY': { interval: 'month', count: 3 },
      'ANNUALLY': { interval: 'year', count: 1 }
    };
    const { interval, count: intervalCount } = intervalMap[billingCycle] || intervalMap['MONTHLY'];

    // 5.5 Create a Stripe Product on the fly for this specific transaction
    // (Stripe Subscriptions require a strict Product ID, not inline product_data)
    const stripeProduct = await stripe.products.create({
      name: `${product.name} (${billingCycle})`,
      description: `OS: ${osVersion.os.name} ${osVersion.version}`,
    });

    // 6. Create the Incomplete Subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'gbp',
          product: stripeProduct.id, // <-- We use the newly created Product ID here!
          unit_amount: finalAmount,
          recurring: {
            interval,
            interval_count: intervalCount
          },
        },
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      // Attach metadata HERE so the webhook can read it after successful payment
      metadata: {
        userId: userId.toString(),
        productId: productId.toString(),
        hostname,
        osVersionId: osVersionId.toString(),
        sshKey: sshKey || 'none',
        userPassword,
        billingCycle,
        location: locationId.toString(),
      },
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    console.error("Subscription Creation Error:", error);
    next(error);
  }
};

/**
 * Returns all active subscriptions for the current user.
 */
export const getMySubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch orders and include the related product and service details
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        product: true,
        service: true // To get the hostname/status
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(orders);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
};

export const getInvoices = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.stripeCustomerId) {
      return res.json([]); // No customer ID = no invoices yet
    }

    // Fetch the 10 most recent invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 10,
    });

    return res.json(invoices.data);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
};

/**
 * Cancels a subscription immediately.
 */
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.id;

    // Verify ownership
    const order = await prisma.order.findUnique({
      where: { stripeSubscriptionId: subscriptionId },
      include: { service: true }
    });

    if (!order || order.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Cancel in Stripe (cancel_at_period_end allows them to use the rest of the month they paid for)
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    // Update DB status
    await prisma.order.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'CANCELLING' }
    });

    return res.json({ success: true, message: "Subscription will cancel at the end of the billing period." });
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
};

export const createPortalSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({ error: "No billing account found." });
    }

    // Create the secure Stripe Portal link
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      // URL to redirect back to after they update their card
      return_url: `${config.frontendUrl}/dashboard/billing`, 
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Portal Error:", error);
    res.status(500).json({ error: "Failed to create portal session" });
  }
};

export const handleWebhook = async (req, res) => {
  console.log("🔔 WEBHOOK HIT! Receiving data from Stripe...");
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
    console.log("✅ Webhook verified successfully! Event Type:", event.type);
  } catch (err) {
    console.error("❌ Webhook Verification Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  let subscriptionId = null;
  let amountPaid = 0;

  // EVENT 1: Invoice Paid (Catches renewals and standard payments)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    subscriptionId = invoice.subscription;
    amountPaid = invoice.amount_paid / 100;

    if (!subscriptionId) {
        console.log(`⚠️ Ignored invoice ${invoice.id}: No subscription attached. (Likely a stray test trigger)`);
        return res.json({ received: true });
    }
  }

  // EVENT 2: Subscription Active (Bulletproof fallback for initial server creation)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    // We only care when the payment clears and the status becomes 'active'
    if (subscription.status === 'active') {
        subscriptionId = subscription.id;
        // Grab the price from the subscription item
        amountPaid = subscription.items.data[0].price.unit_amount / 100;
    }
  }

  // --- CORE PROVISIONING LOGIC ---
  if (subscriptionId) {
    try {
        // Retrieve the full subscription to ensure we have the custom metadata
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const meta = subscription.metadata;

        // Idempotency Check: Did we already process this exact order?
        // (This prevents building 2 servers if both events hit at the exact same time)
        const existingOrder = await prisma.order.findUnique({
            where: { stripeSubscriptionId: subscriptionId }
        });

        if (existingOrder) {
            console.log(`✅ Order for sub ${subscriptionId} already exists. Ignoring duplicate webhook.`);
            return res.json({ received: true });
        }

        // --- FIRST TIME PROVISIONING ---
        if (meta && meta.productId) {
            console.log(`🚀 Payment Cleared! Provisioning NEW service for user ${meta.userId}...`);
            
            // 1. Create DB Record securely
            const serviceEntry = await vpsService.createServiceEntry({
                userId: meta.userId,
                productId: meta.productId,
                hostname: meta.hostname,
                osVersionId: meta.osVersionId,
                amount: amountPaid,
                stripeSubscriptionId: subscriptionId,
                location: meta.location
            });

            console.log(`📦 Database Order & Service created (ID: ${serviceEntry.id}). Contacting Proxmox...`);

            // 2. Trigger Background Provisioning (Proxmox/OVH)
            vpsService.provisionNewVps(serviceEntry.id, {
                sshKey: meta.sshKey === 'none' ? '' : meta.sshKey,
                userPassword: meta.userPassword
            }).catch(err => {
                console.error(`❌ CRITICAL: Provisioning failed for service ${serviceEntry.id}:`, err);
            });

            return res.json({ received: true, status: 'provisioning' });
        } else {
            console.warn(`⚠️ Payment succeeded but no metadata found for sub ${subscriptionId}.`);
        }

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        return res.status(500).json({ error: "Internal processing error" });
    }
  }

  // Return a 200 for unhandled events so Stripe knows we received them safely
  res.json({ received: true });
};