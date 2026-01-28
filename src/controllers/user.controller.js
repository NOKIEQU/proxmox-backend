import prisma from '../services/prisma.service.js';

/**
 * Get current user profile
 */
export const getMe = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        postCode: true,
        country: true,
        stripeCustomerId: true,
        createdAt: true,
      }
    });

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 */
export const updateUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
        firstName, 
        lastName, 
        addressLine1, 
        addressLine2, 
        city, 
        postCode, 
        country
    } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
        addressLine1,
        addressLine2,
        city,
        postCode,
        country
      },
      select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          role: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          postCode: true,
          country: true,
      }
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};