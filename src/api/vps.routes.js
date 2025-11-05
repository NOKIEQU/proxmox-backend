import { Router } from 'express';
// Import all the controller functions
import {
  createVps,
  stopVps,
  startVps,
  rebootVps,
  getMyServices, // <-- Import the new function
} from '../controllers/vps.controller.js';
import { isLoggedIn } from '../middlewares/auth.middleware.js';

const router = Router();

// --- All routes in this file are protected ---
// This middleware runs *before* any route defined below.
// It checks for a valid token and attaches `req.user`.
router.use(isLoggedIn);

// --- NEW ---
// GET /api/vps/my-services
// Gets all services for the logged-in user
router.get('/my-services', getMyServices);

// POST /api/vps/create
// A logged-in user can create a VPS
router.post('/create', createVps);

// POST /api/vps/:vmid/stop
// A logged-in user can stop *their own* VPS
router.post('/:vmid/stop', stopVps);

// POST /api/vps/:vmid/start
// A logged-in user can start *their own* VPS
router.post('/:vmid/start', startVps);

// POST /api/vps/:vmid/reboot
// A logged-in user can reboot *their own* VPS
router.post('/:vmid/reboot', rebootVps);

export default router;