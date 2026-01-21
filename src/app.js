import express from 'express';
import cors from 'cors';
import apiRouter from './api/index.js';
import billingRouter from './api/billing.routes.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

// Global Middlewares
app.use(cors());

/**
 * STRIPE WEBHOOK REQUIREMENT:
 * The billing routes must be mounted BEFORE express.json() 
 * because Stripe needs the raw request body to verify signatures.
 */
app.use('/api/billing', billingRouter);

// Standard JSON parsing for all other routes
app.use(express.json());

// Main API Router
app.use('/api', apiRouter);

// Error Handling (Must be last)
app.use(errorHandler);

export default app;