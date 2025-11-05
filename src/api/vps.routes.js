import { Router } from 'express';
// Import all the controller functions
import {
  createVps,
  stopVps,
  startVps,
  rebootVps,
} from '../controllers/vps.controller.js';

// Import your middlewares
import { isLoggedIn } from '../middlewares/auth.middleware.js';
import { isAdmin } from '../middlewares/admin.middleware.js';

const router = Router();

// --- Protected User Routes (User must be logged in) ---
// All routes below this will first run the isLoggedIn middleware
router.use(isLoggedIn);

// POST /api/vps/create
// A logged-in user can create a VPS
router.post('/create', createVps);

// POST /api/vps/:vmid/start
router.post('/:vmid/start', startVps);

// POST /api/vps/:vmid/stop
router.post('/:vmid/stop', stopVps);

// POST /api/vps/:vmid/reboot
router.post('/:vmid/reboot', rebootVps);

// --- Protected Admin Routes (User must be an ADMIN) ---

// GET /api/vps/all-vms-for-admin
// Example: A route only an admin can access
router.get('/all-vms-for-admin', isAdmin, (req, res) => {
  res.json({ message: 'Welcome Admin, here are all VMs.' });
});

export default router;