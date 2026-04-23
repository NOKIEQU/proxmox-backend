import prisma from '../services/prisma.service.js';

export const getDashboardOverview = async (req, res) => {
  try {
    const [userCount, activeVpsCount, availableIps, activeOrders] = await Promise.all([
      prisma.user.count(),
      prisma.service.count({ where: { status: 'RUNNING' } }),
      prisma.ipAddress.count({ where: { status: 'AVAILABLE' } }),
      prisma.order.findMany({ 
        where: { status: 'ACTIVE' },
        include: { product: true } 
      })
    ]);

    // Calculate approximate MRR
    const mrr = activeOrders.reduce((acc, order) => acc + Number(order.totalAmount), 0);

    res.json({
      stats: {
        users: userCount,
        activeVps: activeVpsCount,
        availableIps,
        mrr: mrr.toFixed(2)
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load overview." });
  }
};

export const getAdminProducts = async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { prices: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to load products." });
  }
};

export const toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const product = await prisma.product.update({
      where: { id },
      data: { isActive }
    });
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to update product." });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    // Note: If a product is linked to an existing order, Prisma will block deletion 
    // unless you have onDelete: Cascade set up. Usually, disabling (isActive: false) is safer.
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: "Cannot delete product currently in use. Disable it instead." });
  }
};

export const getCustomersAndServices = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        orders: true,
        services: {
          include: { ipAddress: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to load customers." });
  }
};

export const updateFullProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, description, stock, specs, prices } = req.body;
    
    // 1. Update the base product
    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name,
        type,
        description,
        stock: parseInt(stock),
        specs: typeof specs === 'string' ? JSON.parse(specs) : specs
      }
    });

    // 2. Update the associated prices
    if (prices) {
      for (const [cycle, price] of Object.entries(prices)) {
        if (price === '' || price === null) continue; // Skip empty fields

        const existingPrice = await prisma.productPrice.findFirst({
          where: { productId: id, billingCycle: cycle }
        });
        
        if (existingPrice) {
          await prisma.productPrice.update({
            where: { id: existingPrice.id },
            data: { price: Number(price) }
          });
        } else {
          await prisma.productPrice.create({
            data: {
              productId: id,
              billingCycle: cycle,
              price: Number(price)
            }
          });
        }
      }
    }
    
    res.json(updatedProduct);
  } catch (error) {
    console.error("Failed to update product:", error);
    res.status(500).json({ error: "Failed to update product details. Check JSON format." });
  }
};

export const getAllSubscriptions = async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        user: true,
        product: true,
        service: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch subscriptions." });
  }
};