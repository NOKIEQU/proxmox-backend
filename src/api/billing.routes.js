import { Router, raw } from 'express';
import * as billingController from '../controllers/billing.controller.js';
import { isLoggedIn } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @route POST /api/billing/create-subscription
 * @desc  Create a subscription and return clientSecret for Stripe Elements
 */
router.post('/create-subscription', isLoggedIn, billingController.createSubscription);

/**
 * @route GET /api/billing/my-subscriptions
 * @desc  Fetch all active subscriptions for the user
 */
router.get('/my-subscriptions', isLoggedIn, billingController.getMySubscriptions);

/**
 * @route POST /api/billing/cancel-subscription
 * @desc  Cancel a specific subscription
 */
router.post('/cancel-subscription', isLoggedIn, billingController.cancelSubscription);

/**
 * @route POST /api/billing/webhook
 * @desc  Stripe Webhook endpoint (Public)
 * Uses express.raw() to handle signature verification correctly
 */
router.post('/webhook', raw({ type: 'application/json' }), billingController.handleWebhook);

export default router;