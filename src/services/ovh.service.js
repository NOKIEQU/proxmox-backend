import ovh from 'ovh';
import config from '../config/index.js';

/**
 * Creates and configures a reusable OVH API client instance.
 *
 * The `endpoint` must be set to 'ovh-eu' for European datacenters (like France).
 */
const ovhClient = ovh({
  endpoint: 'ovh-eu',
  appKey: config.ovhAppKey,
  appSecret: config.ovhAppSecret,
  consumerKey: config.ovhConsumerKey,
});

export default ovhClient;