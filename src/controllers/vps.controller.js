import * as vpsService from '../services/vps.service.js';

/**
 * Get all services for the currently logged-in user.
 * This is for the main user dashboard.
 */
export const getMyServices = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const services = await vpsService.findUserServices(userId);

    // We can re-format the data to be cleaner for the frontend
    const formattedServices = services.map((service) => ({
      id: service.id,
      hostname: service.hostname,
      status: service.status,
      vmid: service.vmid,
      ip: service.ipAddress?.ipAddress ?? null,
      planName: service.order.product.name,
      specs: service.order.product.specs,
      createdAt: service.createdAt,
    }));

    res.status(200).json(formattedServices);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new VPS.
 * This function handles the web request and calls the main provisioning service.
 */
export const createVps = async (req, res, next) => {
  try {
    const { productId, hostname, sshKey, userPassword, os } = req.body;
    const userId = req.user.id;

    // Call the main "robot" service to do all the work
    const service = await vpsService.provisionNewVps({
      userId,
      productId,
      hostname,
      sshKey,
      userPassword,
      os,
    });

    res.status(201).json({
      message: 'VPS provisioning has started successfully!',
      service,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for stopping a VPS
 */
export const stopVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id;

    const result = await vpsService.controlVm(vmid, userId, 'stop');
    res.status(200).json({ message: `VM ${vmid} is stopping.`, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for starting a VPS
 */
export const startVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id;

    const result = await vpsService.controlVm(vmid, userId, 'start');
    res.status(200).json({ message: `VM ${vmid} is starting.`, ...result });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller for rebooting a VPS
 */
export const rebootVps = async (req, res, next) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id;

    const result = await vpsService.controlVm(vmid, userId, 'reboot');
    res.status(200).json({ message: `VM ${vmid} is rebooting.`, ...result });
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req, res) => {
  try {
    const { vmid } = req.params;
    // Assuming your auth middleware attaches the user ID to req.user.id
    const userId = req.user.id; 

    const stats = await vpsService.getVpsStats(vmid, userId);
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching VPS stats:", error);
    // If unauthorized or not found, return 403 or 404
    return res.status(500).json({ message: error.message });
  }
};

export const reinstallOS = async (req, res) => {
  try {
    const { vmid } = req.params;
    const userId = req.user.id; 
    const { sshKey } = req.body; // 🚀 Extract the SSH key from the request

    // 🚀 Validate that the SSH key was provided
    if (!sshKey) {
      return res.status(400).json({ message: "SSH Public Key is required for reinstallation." });
    }

    // 🚀 Pass the sshKey to the service
    const result = await vpsService.reinstallVps(vmid, userId, sshKey);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error formatting VPS:", error);
    return res.status(500).json({ message: error.message });
  }
};