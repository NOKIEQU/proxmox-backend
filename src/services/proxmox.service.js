import proxmoxApi from 'proxmox-api';
import config from '../config/index.js';

/**
 * Creates and configures a reusable Proxmox API client instance.
 *
 * We are authenticating using an API Token.
 * `rejectUnauthorized: false` is often needed if your Proxmox server
 * is using a self-signed SSL certificate (which is the default).
 * For production, you should use a real certificate (e.g., from Let's Encrypt).
 */
const proxmox = proxmoxApi({
  host: config.pveHost,
  port: 8006,
  user: config.pveTokenId,    // e.g., 'backend@pve'
  token: config.pveTokenSecret, // The secret key
  "rejectUnauthorized": false // Set to true in production with a valid cert
});

export default proxmox;