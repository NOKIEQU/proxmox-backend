// src/services/prisma.service.js
// Thin wrapper that exports a single PrismaClient instance.
// Using a singleton here avoids multiple connection pools when modules import Prisma.
import { PrismaClient } from '../../generated/prisma/client.js';

const prisma = new PrismaClient();

export default prisma;