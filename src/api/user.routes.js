import { Router } from 'express';
import { getMe, updateUser } from '../controllers/user.controller.js';
import { isLoggedIn } from '../middlewares/auth.middleware.js';

const router = Router();

// Retrieve current user profile
router.get('/me', isLoggedIn, getMe);

// Update user info
router.put('/me', isLoggedIn, updateUser);

export default router;
