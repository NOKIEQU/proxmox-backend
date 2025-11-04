import { Router } from 'express';
import { register, login } from '../controllers/auth.controller.js';

const router = Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', register);

// @route   POST /api/auth/login
// @desc    Log in a user and get a token
router.post('/login', login);

export default router;
