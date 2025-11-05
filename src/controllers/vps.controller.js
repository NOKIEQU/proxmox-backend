import prisma from '../services/prisma.service.js';
import * as vpsService from '../services/vps.service.js';

/**
 * Controller to create a new VPS.
 * It's called by the POST /api/vps/create route.
 */
export const createVps = async (req, res, next) => {
  try {
    // 1. Get data from the request body
    const { productId, hostname, sshKey, userPassword } = req.body;
    
    // 2. Get the user ID from the auth middleware
    const userId = req.user.id;

    // 3. Call the provisioning service
    const service = await vpsService.provisionNewVps({
      userId,
      productId,
      hostname,
      sshKey,
      userPassword,
    });

    // 4. Send the successful response
    res.status(201).json({
      message: 'VPS provisioning has started!',
      service,
    });
  } catch (error) {
    // 5. Pass any errors to the central error handler
    next(error);
  }
};

/**
 * Controller to stop a VPS.
 * It's called by POST /api/vps/:vmid/stop
 */
export const stopVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id; // From isLoggedIn middleware

    const result = await vpsService.controlVm(vmid, userId, 'stop');
    
    res.status(200).json({ message: 'VM is stopping.', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to start a VPS.
 * It's called by POST /api/vps/:vmid/start
 */
export const startVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id;

    const result = await vpsService.controlVm(vmid, userId, 'start');
    
    res.status(200).json({ message: 'VM is starting.', data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to reboot a VPS.
 * It's called by POST /api/vps/:vmid/reboot
 */
export const rebootVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id;

    const result = await vpsService.controlVm(vmid, userId, 'reboot');
    
    res.status(200).json({ message: 'VM is rebooting.', data: result });
  } catch (error) {
    next(error);
  }
};