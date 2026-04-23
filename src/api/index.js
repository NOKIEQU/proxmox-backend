import { Router } from 'express';
import vpsRoutes from './vps.routes.js';
import authRoutes from './auth.routes.js'; 
import productRoutes from './product.routes.js';
import osRoutes from './os.routes.js';
import userRoutes from './user.routes.js';
import locationRoutes from './location.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Mount all your different API routes
router.use('/vps', vpsRoutes);
router.use('/auth', authRoutes); 
router.use('/products', productRoutes); 
router.use('/os', osRoutes);
router.use('/users', userRoutes);
router.use('/locations', locationRoutes);
router.use('/admin', adminRoutes);

export default router;
