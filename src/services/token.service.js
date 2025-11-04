import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Generates a new JWT token
 * @param {string} userId - The user's ID
 * @param {string} userRole - The user's role (e.g., 'USER' or 'ADMIN')
 * @returns {string} The signed JWT token
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
