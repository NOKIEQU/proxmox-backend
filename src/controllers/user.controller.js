import prisma from '../services/prisma.service.js';
import bcrypt from 'bcryptjs';

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

export const updatePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // 1. Find user to get their current hashed password
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 2. Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // 3. Hash and save the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    });

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};