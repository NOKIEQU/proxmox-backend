import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.controller.js';

// Import your middlewares
import { isLoggedIn } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/admin.middleware.js';

const router = Router();

// --- Public Routes ---
// GET /api/products
router.get('/', getAllProducts);

// GET /api/products/:id
router.get('/:id', getProductById);


// --- Admin-Only Routes ---
// All routes below this will check for a valid token AND an admin role
router.use(isLoggedIn, isAdmin);

// POST /api/products
router.post('/', createProduct);

// PATCH /api/products/:id
router.patch('/:id', updateProduct);

// DELETE /api/products/:id
router.delete('/:id', deleteProduct);

export default router;