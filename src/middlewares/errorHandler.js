/**
 * Centralized Error Handling Middleware
 *
 * This middleware must be the last `app.use()` in your app.js.
 * It catches all errors passed to `next(error)`.
 * It must have 4 arguments (err, req, res, next) for Express to recognize it
 * as an error-handling middleware.
 */
const errorHandler = (err, req, res, next) => {
  // Log the error to the console for debugging
  console.error(err.stack);

  // Default to a 500 Internal Server Error if no specific status code is set
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Something went wrong on the server';

  // Send a structured JSON error response
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: message,
    // Only include the detailed stack trace when in development mode
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

export default errorHandler;
