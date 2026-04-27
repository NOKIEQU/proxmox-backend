// src/services/token.service.js
// Small helpers around JWT creation/verification. Keep secrets in `.env`.
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Generates a new JWT token for a user.
 * Short-lived by design (24h) — rotate or issue refresh tokens if you need longer sessions.
 */
export const generateToken = (userId, userRole) => {
  return jwt.sign(
    { 
      id: userId, 
      role: userRole 
    },
    config.jwtSecret,
    { expiresIn: '24h' } // Token expires in 24 hours
  );
};
