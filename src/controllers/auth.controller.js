import prisma from '../services/prisma.service.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../services/token.service.js';

/**
 * Register a new user
 */
export const register = async (req, res, next) => {
  try {
    const { email, username, password, firstName, lastName } = req.body;

    // 1. Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email or username already exists' });
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // 3. Create the user
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        firstName,
        lastName,
        // All other fields (address etc.) are optional
      },
    });

    // 4. Generate a token
    const token = generateToken(user.id, user.role);

    // 5. Send the response (omitting the password)
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error); // Pass errors to the central error handler
  }
};

/**
 * Log in an existing user
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 2. Check the password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // 3. Generate a token
    const token = generateToken(user.id, user.role);

    // 4. Send the response
    res.status(200).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
