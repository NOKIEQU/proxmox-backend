import * as vpsService from '../services/vps.service.js';
import prisma from '../services/prisma.service.js';

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
      ip: service.ipAddress.ipAddress,
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