import dotenv from 'dotenv';

dotenv.config();

// Load all environment variables
const config = {
  port: process.env.PORT,
  jwtSecret: process.env.JWT_SECRET, // <-- Add this
  
  // Proxmox Config
  pveHost: process.env.PVE_HOST,
  pveTokenId: process.env.PVE_TOKEN_ID,
  pveTokenSecret: process.env.PVE_TOKEN_SECRET,
  
  // OVH Config
  ovhAppKey: process.env.OVH_APP_KEY,
  ovhAppSecret: process.env.OVH_APP_SECRET,
  ovhConsumerKey: process.env.OVH_CONSUMER_KEY,

  // Stripe Config
  stripeSecretKey: process.env.STRIPE_API_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000', // Default for local dev

  // Database
  databaseUrl: process.env.DATABASE_URL
};

export default config;
