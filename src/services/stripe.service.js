// src/services/stripe.service.js
// Thin Stripe client wrapper. Import `stripe` where you need to make API calls.
import Stripe from 'stripe';
import config from '../config/index.js';

/**
 * Initializes the Stripe client using the secret key from config.
 * Keep this minimal so callers can `import { stripe } from './stripe.service.js'`.
 */
export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2023-10-16',
});