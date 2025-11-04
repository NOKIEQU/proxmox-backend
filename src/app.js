import express from 'express';
import cors from 'cors';
import apiRouter from './api/index.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Main API Router
app.use('/', apiRouter);

// Error Handling
app.use(errorHandler);

export default app;