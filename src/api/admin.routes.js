import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { isLoggedIn } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/admin.middleware.js';

const router = Router();

router.use(isLoggedIn, isAdmin);

router.get('/overview', adminController.getDashboardOverview);
router.get('/products', adminController.getAdminProducts);
router.patch('/products/:id/toggle', adminController.toggleProductStatus);
router.delete('/products/:id', adminController.deleteProduct);
router.get('/customers', adminController.getCustomersAndServices);
router.put('/products/:id', adminController.updateFullProduct);
router.get('/subscriptions', adminController.getAllSubscriptions);

export default router;