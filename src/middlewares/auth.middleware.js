import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import prisma from '../services/prisma.service.js';

/**
 * Middleware to check if a user is authenticated.
 * It verifies the JWT token from the Authorization header.
 * If valid, it attaches the user payload to req.user.
 */
export const isLoggedIn = async (req, res, next) => {
  let token;

  // Check for the token in the 'Authorization' header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (e.g., "Bearer YOUR_TOKEN")
      token = req.headers.authorization.split(' ')[1];

      // Verify the token
      const decoded = jwt.verify(token, config.jwtSecret);

      // Get user from the token's ID and attach it to the request object
      // We exclude the password from the object we attach
      req.user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
        },
      });

      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // Proceed to the next middleware or controller
      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};
