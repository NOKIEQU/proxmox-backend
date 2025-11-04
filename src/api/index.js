import { Router } from 'express';
import vpsRoutes from './vps.routes.js';
import authRoutes from './auth.routes.js'; // <-- Import new routes

const router = Router();

// Mount all your different API routes
router.use('/vps', vpsRoutes);
router.use('/auth', authRoutes); // <-- Use new routes

export default router;
