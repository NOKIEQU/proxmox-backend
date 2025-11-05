import * as productService from '../services/product.service.js';

/**
 * Get all products
 * (Public)
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const products = await productService.getAllProducts();
    res.status(200).json(products);
  } catch (error) {
    next(error);
  }
};

/**
 * Get one product by ID
 * (Public)
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    res.status(200).json(product);
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new product
 * (Admin Only)
 */
export const createProduct = async (req, res, next) => {
  try {
    // req.body will contain name, description, price, specs, stock, etc.
    const newProduct = await productService.createProduct(req.body);
    res.status(201).json(newProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * Update a product
 * (Admin Only)
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedProduct = await productService.updateProduct(id, req.body);
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a product
 * (Admin Only)
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;
    await productService.deleteProduct(id);
    res.status(204).send(); // 204 No Content is standard for delete
  } catch (error) {
    next(error);
  }
};