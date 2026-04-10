import prisma from '../services/prisma.service.js';

/**
 * Get all active Operating Systems and their specific versions.
 * This is used by the frontend to populate the checkout configuration.
 */
export const getAllOS = async (req, res, next) => {
  try {
    // 1. FIX: Use operatingSystem instead of oS
    const osList = await prisma.operatingSystem.findMany({
      include: {
        versions: {
          orderBy: { version: 'desc' } // e.g., Ubuntu 24.04 before 22.04
        }
      },
      orderBy: { name: 'asc' }
    });

    const formattedOptions = [];
    
    osList.forEach(osItem => {
      osItem.versions.forEach(version => {
        formattedOptions.push({
          id: version.id, // This is the exact UUID the billing controller needs!
          osId: osItem.id,
          name: `${osItem.name} ${version.version}`,
          
          // 2. FIX: Since your DB doesn't have a premium field yet, we hardcode 0
          // If you add Windows later, you can add a 'premium' field to OsVersion in schema.prisma
          premium: 0, 
          image: osItem.imageUrl, // Assuming you have an image field in your DB for each OS
          // Map a string icon name to render dynamically on the frontend
          iconName: osItem.name.toLowerCase().includes('ubuntu') ? 'ubuntu' 
                  : osItem.name.toLowerCase().includes('debian') ? 'debian' 
                  : osItem.name.toLowerCase().includes('windows') ? 'windows' 
                  : 'linux'
        });
      });
    });

    res.json(formattedOptions);
  } catch (error) {
    console.error("Error fetching OS List:", error);
    next(error);
  }
};