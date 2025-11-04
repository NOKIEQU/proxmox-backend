import { provisionNewVps } from '../services/vps.service.js';

export const createVps = async (req, res, next) => {
  try {
    // 1. Get data from the user
    const { plan, os, sshKey } = req.body;
    // const userId = req.user.id; // from auth middleware

    // 2. Call the service to do the work
    const newVps = await provisionNewVps({ plan, os, sshKey });

    // 3. Send the response
    res.status(201).json({ message: "VPS creation in progress!", vps: newVps });
  } catch (error) {
    next(error); // Pass the error to your error handler
  }
};

export const stopVps = async (req, res, next) => {
  // ... similar logic ...
};