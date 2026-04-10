import prisma from '../services/prisma.service.js';

export const getActiveLocations = async (req, res, next) => {
  try {
    const locations = await prisma.location.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });
    res.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    next(error);
  }
};