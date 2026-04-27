// src/app.js
// Express application setup for the public API server.
// I keep this file intentionally small: configure middleware, mount
// API routes and error handling, and initialize background cron jobs.
// (If you need to run the server directly, import this and call `app.listen`.)
import express from 'express';
import cors from 'cors';
import apiRouter from './api/index.js';
import billingRoutes from './api/billing.routes.js';
import errorHandler from './middlewares/errorHandler.js';
import { initCronJobs } from './cron/billing.cron.js';

const app = express();

app.use(cors());
initCronJobs();

app.use(
  '/api/billing/webhook', 
  express.raw({ type: 'application/json' })
);

// Standard JSON parsing for all OTHER routes
app.use(express.json());

app.use('/api/billing', billingRoutes);
app.use('/api', apiRouter);
app.use(errorHandler);

export default app;