import { isLoggedIn } from './auth.middleware.js';

/**
 * Middleware to check if a user is an ADMIN.
 * This should be used *after* the isLoggedIn middleware.
 */
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'ADMIN') {
    // User is logged in and is an admin, proceed
    next();
  } else {
    // User is logged in but not an admin
    return res.status(403).json({ message: 'Not authorized as an admin' });
  }
};
