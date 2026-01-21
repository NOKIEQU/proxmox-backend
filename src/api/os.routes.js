import { Router } from 'express';
import prisma from '../services/prisma.service.js';
import { isAdmin } from '../middlewares/admin.middleware.js'; // Ensure you have this

const router = Router();

import { isLoggedIn } from '../middlewares/auth.middleware.js';

// --- PUBLIC ROUTES ---

/**
 * @route GET /api/os
 * @desc  Get all available Operating Systems and their versions
 */
router.get('/', async (req, res) => {
  try {
    const osList = await prisma.operatingSystem.findMany({
      include: {
        versions: true // Include nested versions
      }
    });
    res.json(osList);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch OS list' });
  }
});

// --- ADMIN ROUTES (Protected) ---

/**
 * @route POST /api/os
 * @desc  Create a new OS Family (e.g. "Ubuntu")
 */
router.post('/', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, imageUrl, type } = req.body;
    const newOs = await prisma.operatingSystem.create({
      data: { name, imageUrl, type }
    });
    res.json(newOs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create OS' });
  }
});

/**
 * @route POST /api/os/:id/version
 * @desc  Add a version to an OS (e.g. "22.04" -> ID 9000)
 */
router.post('/:id/version', isLoggedIn, isAdmin, async (req, res) => {
  try {
    const osId = req.params.id;
    const { version, proxmoxTemplateId, cloudInitUser } = req.body;

    const newVersion = await prisma.osVersion.create({
      data: {
        version,
        proxmoxTemplateId: parseInt(proxmoxTemplateId),
        cloudInitUser, // optional, defaults to 'ubuntu'
        osId
      }
    });

    res.json(newVersion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add OS version' });
  }
});

/**
 * @route DELETE /api/os/version/:id
 * @desc Delete a specific version
 */
router.delete('/version/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        await prisma.osVersion.delete({ where: { id: req.params.id } });
        res.json({ message: 'Version deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete version' });
    }
});

export default router;
