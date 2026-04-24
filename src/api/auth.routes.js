import { Router } from 'express';
import { register, login, requestPasswordReset, resetPassword } from '../controllers/auth.controller.js';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Log in a user and get a token
router.post('/login', login);

router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

export default router;
