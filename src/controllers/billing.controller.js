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
    const { productId, hostname, sshKey, userPassword, osVersionId, billingCycle } = req.body;
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
          currency: 'usd',
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
        billingCycle
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
export const getMySubscriptions = async (req, res, next) => { /* ... Keep existing logic ... */ };

/**
 * Cancels a subscription immediately.
 */
export const cancelSubscription = async (req, res, next) => { /* ... Keep existing logic ... */ };

export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify the webhook signature securely
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook Verification Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle Recurring Payment Success (Initial & Renewal)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;

    // --- ADD THIS SAFEGUARD ---
    // If this invoice isn't tied to a subscription (e.g., a one-off payment or test), ignore it safely.
    if (!subscriptionId) {
        console.log("Ignored invoice.payment_succeeded: No subscription attached.");
        return res.json({ received: true });
    }
    // --------------------------

    try {
        // Now it is 100% safe to retrieve the subscription
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const meta = subscription.metadata;

        // Idempotency Check: Did we already process this exact invoice?
        const existingOrder = await prisma.order.findUnique({
            where: { stripeSubscriptionId: subscriptionId }
        });

        if (existingOrder) {
            console.log(`Order for sub ${subscriptionId} already exists. Extending validity...`);
            // It's a renewal. Extend validity based on the billing cycle.
            // await prisma.order.update({ ... });
            return res.json({ received: true });
        }

        // --- FIRST TIME PROVISIONING ---
        if (meta && meta.productId) {
            console.log(`Provisioning NEW service for user ${meta.userId}...`);
            
            // 1. Create DB Record securely
            const serviceEntry = await vpsService.createServiceEntry({
                userId: meta.userId,
                productId: meta.productId,
                hostname: meta.hostname,
                osVersionId: meta.osVersionId,
                amount: invoice.amount_paid / 100, // Convert cents back to dollars
                stripeSubscriptionId: subscriptionId
            });

            // 2. Trigger Background Provisioning (Proxmox/OVH)
            vpsService.provisionNewVps(serviceEntry.id, {
                sshKey: meta.sshKey === 'none' ? '' : meta.sshKey,
                userPassword: meta.userPassword
            }).catch(err => {
                console.error(`CRITICAL: Provisioning failed for service ${serviceEntry.id}:`, err);
            });

            return res.json({ received: true, status: 'provisioning' });
        } else {
            console.warn(`Payment succeeded but no metadata found for sub ${subscriptionId}`);
        }

    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ error: "Internal processing error" });
    }
  }

  // Return a 200 for unhandled events so Stripe knows we received them safely
  res.json({ received: true });
};