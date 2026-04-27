// src/services/proxmox.service.js
// Small helper that creates a preconfigured Axios client for talking to Proxmox.
// Notes to reviewers: this client intentionally relaxes TLS for development
// (self-signed Proxmox certificates). In production you should replace that
// behavior with a proper CA-signed certificate or OS-level trust.
import axios from 'axios';
import https from 'https';
import config from '../config/index.js';

/**
 * Creates and configures a reusable Axios client for the Proxmox API.
 * This directly accepts standard HTTP requests (GET, POST, PUT, DELETE)
 * using the raw Proxmox endpoints (e.g., /nodes/pve/qemu).
 */

// 1. Format the Token ID properly for Proxmox headers
// Proxmox requires the Token ID to include the specific token name.
// e.g., 'backend@pve!mytoken'
// If your PVE_TOKEN_ID in .env is just 'backend@pve', you MUST append the token name you created in the GUI.
// (Assuming you named the token 'backend' in the GUI, it becomes 'backend@pve!backend')
const tokenId = config.pveTokenId.includes('!') 
    ? config.pveTokenId 
    : `${config.pveTokenId}!backend-token`; // Change '!backend' to whatever you named the token in Proxmox

// 2. Build the Authorization Header
const authHeader = `PVEAPIToken=${tokenId}=${config.pveTokenSecret}`;

// 3. Create the Axios Instance
const proxmox = axios.create({
  baseURL: `https://${config.pveHost}:8006/api2/json`,
  headers: {
    'Authorization': authHeader,
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  // Proxmox uses self-signed certs by default. This bypasses the strict SSL check for development.
  httpsAgent: new https.Agent({  
    rejectUnauthorized: false 
  })
});

// 4. (Optional but highly recommended) Add an interceptor to cleanly extract the 'data' array from Proxmox responses
proxmox.interceptors.response.use(
  (response) => {
    // Proxmox always wraps its actual response inside a "data" object.
    // e.g., { data: { data: 105 } }. This interceptor flattens it so your vps.service.js stays clean.
    return { data: response.data.data }; 
  },
  (error) => {
    console.error("Proxmox API Error:", error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default proxmox;