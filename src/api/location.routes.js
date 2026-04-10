import { Router } from 'express';
import * as locationController from '../controllers/location.controller.js';

const router = Router();

// GET /api/locations
router.get('/', locationController.getActiveLocations);

export default router;