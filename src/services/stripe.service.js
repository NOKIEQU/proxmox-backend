import Stripe from 'stripe';
import config from '../config/index.js';

/**
 * Initializes the Stripe client using the secret key from config.
 */
export const stripe = new Stripe(config.stripeSecretKey, {
  apiVersion: '2023-10-16',
});