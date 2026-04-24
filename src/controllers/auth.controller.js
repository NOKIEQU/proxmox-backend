import prisma from '../services/prisma.service.js';
import bcrypt from 'bcryptjs';
import { generateToken } from '../services/token.service.js';
import * as emailService from '../services/email.service.js';

/**
 * Register a new user
 */
export const register = async (req, res, next) => {
  try {
    const { 
        email, 
        username, 
        password, 
        firstName, 
        lastName, 
        addressLine1, 
        city, 
        postCode, 
        country // <--- Added fields from frontend
    } = req.body;

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
        addressLine1,
        city,
        postCode,
        country
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

export const requestPasswordReset = async (req, res) => {
  console.log("Received password reset request for email:", req.body.email);
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    // Return 200 anyway to prevent email enumeration attacks
    return res.json({ message: "If an account exists, a code has been sent." });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetCode: code, passwordResetExpiry: expiry }
  });

  await emailService.sendPasswordResetCode(user.email, code);
  console.log(`Password reset code ${code} sent to ${user.email} (expires at ${expiry.toISOString()})`);

  return res.json({ message: "If an account exists, a code has been sent." });
};

// Add this to src/controllers/auth.controller.js
export const resetPassword = async (req, res, next) => {
  console.log("Received password reset submission for email:", req.body.email);
  try {
    const { email, code, newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(400).json({ message: "Invalid request." });
    }

    // 1. Check if the code matches and is not expired
    if (user.passwordResetCode !== code) {
      return res.status(400).json({ message: "Invalid verification code." });
    }

    if (new Date() > new Date(user.passwordResetExpiry)) {
      return res.status(400).json({ message: "Verification code has expired. Please request a new one." });
    }

    // 2. Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // 3. Update the user record and clear the reset code tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetExpiry: null,
      }
    });

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
};