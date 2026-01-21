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
    const userId = req.user.id;

    if (!['MONTHLY', 'QUARTERLY', 'ANNUALLY'].includes(billingCycle)) {
        return res.status(400).json({ message: 'Invalid billing cycle' });
    }

    // 1. Validate Product
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

    // 3. Validate OS SELECTION (New)
    // We check if the version exists in our DB to prevent bad data
    const osVersion = await prisma.osVersion.findUnique({ 
        where: { id: osVersionId },
        include: { os: true } 
    });
    
    if (!osVersion) {
        return res.status(400).json({ message: 'Invalid OS Version selected' });
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
    let interval = 'month';
    let intervalCount = 1;

    switch (billingCycle) {
        case 'QUARTERLY':
            interval = 'month';
            intervalCount = 3;
            break;
        case 'ANNUALLY':
            interval = 'year';
            intervalCount = 1;
            break;
        case 'MONTHLY':
        default:
            interval = 'month';
            intervalCount = 1;
            break;
    }

    // 6. Create Subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: `${product.name} (${billingCycle})`,
            description: product.description,
          },
          unit_amount: Math.round(Number(initPrice.price) * 100),
          recurring: { 
              interval,
              interval_count: intervalCount 
          },
        },
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: { 
        userId, 
        productId, 
        hostname, 
        osVersionId,
        sshKey, 
        userPassword,
        productPrice: initPrice.price.toString(),
        billingCycle: billingCycle
      },
    });

    res.json({
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice.payment_intent.client_secret,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns all active subscriptions for the current user.
 */
export const getMySubscriptions = async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { 
        userId: req.user.id,
        stripeSubscriptionId: { not: null },
        status: { not: 'CANCELLED' } // Optionally filter
      },
      include: { product: true, service: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancels a subscription immediately.
 */
export const cancelSubscription = async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;
    const userId = req.user.id;

    // Verify ownership via local DB
    const order = await prisma.order.findUnique({
      where: { stripeSubscriptionId: subscriptionId }
    });

    if (!order || order.userId !== userId) {
      return res.status(403).json({ message: 'Subscription not found or unauthorized' });
    }

    // Cancel at Stripe
    // 'deleted' is the status for cancelled subscriptions
    const deletedSubscription = await stripe.subscriptions.cancel(subscriptionId);

    // Update DB
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'CANCELLED' }
    });

    // We do NOT automatically delete the service to prevent data loss.
    // Admin should do that manually or via another process.
    if (order.service) {
         // Optionally set service status to SUSPENDED
         // await prisma.service.update(...)
    }

    res.json({ message: 'Subscription cancelled successfully', status: deletedSubscription.status });
  } catch (error) {
    next(error);
  }
};

/**
 * Securely handles Stripe Webhooks to trigger VPS provisioning.
 */
export const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
  } catch (err) {
    console.error("Webhook Verification Failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle Recurring Payment Success (Initial & Renewal)
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;

    // We must fetch the subscription to get the metadata (sshKey, hostname, etc.)
    // because the Invoice object doesn't always have it.
    let subscription, meta;
    try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId);
        meta = subscription.metadata;
    } catch (e) {
        console.error("Failed to retrieve subscription details:", e);
        return res.status(500).json({ error: "Connect error" });
    }

    // If this is the FIRST payment, meta.productId will be present.
    // If we wanted to distinguish initial vs renewal, we could check invoice.billing_reason.
    
    if (!meta || !meta.productId) {
       console.log(`No provisioning metadata found for ${subscriptionId}. Is this a legacy sub or simple renewal?`);
       // If it's just a renewal and we already have the order, we just extend.
       // Proceed to check DB.
    }

    try {
      // Check if service/order already exists (Idempotency)
      const existingOrder = await prisma.order.findUnique({
        where: { stripeSubscriptionId: subscriptionId }
      });

      if (existingOrder) {
        console.log(`Order ${existingOrder.id} already exists. Extending validity...`);
        // Extend validity by one billing period (simplified to 30 days)
        await prisma.order.update({
           where: { id: existingOrder.id },
           data: { paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        });
        return res.json({ received: true });
      }

      // --- FIRST TIME PROVISIONING ---
      if (meta && meta.productId) {
        console.log("Provisioning NEW service from invoice.payment_succeeded...");
        
        // 1. Create DB Record (Order + Service)
        const serviceEntry = await vpsService.createServiceEntry({
            userId: meta.userId,
            productId: meta.productId,
            hostname: meta.hostname,
            osVersionId: meta.osVersionId, // Passed from CreateSubscription
            amount: parseFloat(meta.productPrice || '0'), 
            stripeSubscriptionId: subscriptionId
        });

        // 2. Trigger Background Provisioning
        vpsService.provisionNewVps(serviceEntry.id, {
            sshKey: meta.sshKey,
            userPassword: meta.userPassword
        }).catch(err => {
            console.error("Critical Provisioning Error (Elements Flow):", err);
        });
      } else {
        console.warn("Received payment success but no metadata to provision, and order does not exist.");
      }

    } catch (error) {
      console.error("Error processing invoice webhook:", error);
      // Do not 500 here if it's a logic error, otherwise Stripe retries infinitely.
      // Only 500 on transcient DB errors.
    }
  }

  res.json({ received: true });
};
