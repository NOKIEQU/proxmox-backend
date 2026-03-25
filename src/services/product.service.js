import prisma from './prisma.service.js';

/**
 * Get all available products
 * This is a public service
 */
export const  getAllProducts = async () => {
  return prisma.product.findMany({
    where: {
      // Only show products that are not out of stock
      // (stock = -1 means unlimited)
      OR: [
        { stock: -1 },
        { stock: { gt: 0 } },
      ],
    },
    include: {
      prices: {
        orderBy: { billingCycle: 'asc' },
      },
    },
  });
};

/**
 * Get a single product by its ID
 * This is a public service
 */
export const getProductById = async (id) => {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      prices: {
        orderBy: { billingCycle: 'asc' },
      },
    },
  });

  if (!product) {
    throw new Error('Product not found');
  }
  return product;
};

/**
 * Create a new product
 * This is an admin-only service
 */
export const createProduct = async (productData) => {
  return prisma.product.create({
    data: productData,
  });
};

/**
 * Update an existing product
 * This is an admin-only service
 */
export const updateProduct = async (id, updateData) => {
  return prisma.product.update({
    where: { id },
    data: updateData,
  });
};

/**
 * Delete a product
 * This is an admin-only service
 */
export const deleteProduct = async (id) => {
  // You might add logic here to check if any active services
  // are using this product before deleting.
  return prisma.product.delete({
    where: { id },
  });
};