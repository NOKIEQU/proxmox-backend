import { Router } from 'express';
import { getMe, updateUser, updatePassword } from '../controllers/user.controller.js'; // <-- Import updatePassword
import { isLoggedIn } from '../middlewares/auth.middleware.js';

const router = Router();

// Retrieve current user profile
router.get('/me', isLoggedIn, getMe);

// Update user info
router.put('/me', isLoggedIn, updateUser);

// Update user password
router.put('/me/password', isLoggedIn, updatePassword); // <-- Add this route

export default router;