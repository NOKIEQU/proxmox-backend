import prisma from './prisma.service.js';
import proxmox from './proxmox.service.js';
import ovhClient from './ovh.service.js';

// --- Configuration ---
const NODE_NAME = 'ns3191007'; // Your Proxmox node name
const BRIDGE_NAME = 'vmbr0';   // Your public bridge
const DEFAULT_USER = 'ubuntu'; // Default CI User (fallback)

/**
 * Creates the initial database entry for a service immediately after payment.
 * This reserves the "slot" in the database while the background worker builds the VM.
 * 
 * @param {object} params
 * @param {string} params.userId
 * @param {string} params.productId
 * @param {string} params.hostname
 * @param {string} params.osVersionId - ID of the selected OS Version
 * @param {string} params.stripeSubscriptionId
 * @param {number} params.amount
 * @returns {Promise<object>} The newly created service record.
 */
export const createServiceEntry = async ({
  userId,
  productId,
  hostname,
  osVersionId, 
  stripeSubscriptionId,
  amount
}) => {
  // 1. Get Product Details
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });
  if (!product) throw new Error('Product not found');

  // Verify OS Exists (Double check)
  const osVersion = await prisma.osVersion.findUnique({
      where: { id: osVersionId }
  });
  // Fallback to error or default if missing? Better to error.
  if(!osVersion) throw new Error("CRITICAL: Invalid OS Version in webhook payload.");

  // 2. Create Order
  const order = await prisma.order.create({
    data: {
      totalAmount: amount,
      status: 'ACTIVE',
      userId: userId,
      productId: productId,
      paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      stripeSubscriptionId: stripeSubscriptionId // Store the ID
    },
  });

  // 3. Create Service 
  const service = await prisma.service.create({
    data: {
      hostname: hostname,
      status: 'BUILDING', 
      osVersionId: osVersion.id, // Link to DB
      userId: userId,
      orderId: order.id,
    },
  });

  return service;
};

/**
 * Orchestrates the VPS provisioning process for an EXISTING service entry.
 * Should be called in the background.
 *
 * @param {string} serviceId - The ID of the service to provision.
 * @param {object} secrets - Sensitive data not stored in DB.
 * @param {string} secrets.sshKey
 * @param {string} secrets.userPassword
 */
export const provisionNewVps = async (serviceId, { sshKey, userPassword }) => {
  let ipRecord, vmac, vmid;

  try {
    // --- Step 1: Get Service & Product Info ---
    console.log(`Starting provisioning for service ${serviceId}`);
    
    const service = await prisma.service.findUnique({
        where: { id: serviceId },
        include: { 
            order: { include: { product: true } },
            osVersion: true // Include the OS details!
        }
    });

    if (!service) throw new Error('Service not found');
    const product = service.order.product;
    const { hostname, userId, osVersion } = service; 

    // Determine Template ID based on OS from DB
    if (!osVersion) throw new Error("Service has no associated OS Version!");
    
    const templateId = osVersion.proxmoxTemplateId;
    const ciUser = osVersion.cloudInitUser || DEFAULT_USER;

    // Get product specs. 
    /** @type {{ vcpus: number, ramGB: number, storageGB: number, location: string }} */
    const specs = product.specs;

    // --- Step 2: Find & Reserve a Free IP ---
    console.log(`Searching for available IP in ${specs.location}...`);
    ipRecord = await prisma.ipAddress.findFirst({
      where: { status: 'AVAILABLE', location: specs.location },
    });

    if (!ipRecord) {
      throw new Error(`No available IP addresses in ${specs.location}.`);
    }

    await prisma.ipAddress.update({
      where: { id: ipRecord.id },
      data: { status: 'RESERVED' },
    });
    console.log(`Reserved IP: ${ipRecord.ipAddress}`);

    // --- Step 3: Call OVH API to Create vMAC ---
    const encodedIpBlock = encodeURIComponent(ipRecord.ipBlock);
    
    console.log(`Calling OVH API to create vMAC for IP block ${ipRecord.ipBlock}...`);
    
    const vmacResponse = await ovhClient.request('POST', `/ip/${encodedIpBlock}/virtualMac`, {
      ipAddress: ipRecord.ipAddress, 
      type: 'ovh',                   
      vmName: hostname,
    });
    
    vmac = vmacResponse.macAddress; 
    console.log(`Successfully created vMAC ${vmac} for ${ipRecord.ipAddress}`);

    // --- Step 4: Call Proxmox API to Create VM ---
    console.log('Finding next available VMID...');
    const nextIdResponse = await proxmox.get(`/nodes/${NODE_NAME}/nextid`);
    vmid = nextIdResponse.data;
    console.log(`Next available VMID is ${vmid}`);
    
    // 4a. Clone the template
    console.log(`Cloning template ${templateId} to new VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${templateId}/clone`, {
      newid: vmid,
      name: hostname,
      full: true,
    });

    // 4b. Configure the VM's hardware 
    console.log(`Configuring VM ${vmid} hardware...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      cores: specs.vcpus,
      memory: specs.ramGB * 1024, 
      net0: `virtio=${vmac},bridge=${BRIDGE_NAME}`, 
    });
    
    // 4c. Resize the disk
    console.log(`Resizing disk to ${specs.storageGB}G...`);
    await proxmox.put(`/nodes/${NODE_NAME}/qemu/${vmid}/resize`, {
      disk: 'scsi0', 
      size: `${specs.storageGB}G`,
    });

    // 4d. Configure Cloud-Init 
    console.log(`Setting Cloud-Init config for VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      ciuser: ciUser,
      cipassword: userPassword, 
      sshkeys: sshKey,         
      ipconfig0: `ip=${ipRecord.ipAddress}/32,gw=${ipRecord.gateway}`,
    });

    // 4e. Start the VM!
    console.log(`Starting VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/start`);

    // --- Step 5: Update Service and IP in Database ---
    console.log(`Finalizing database records for service ${service.id}...`);
    
    // Update Service
    await prisma.service.update({
      where: { id: service.id },
      data: {
        status: 'RUNNING',
        vmid: parseInt(vmid),
        node: NODE_NAME,
        ipAddressId: ipRecord.id, // Link the IP
      },
    });
    
    // Update IP Address Record
    await prisma.ipAddress.update({
      where: { id: ipRecord.id },
      data: {
        status: 'IN_USE',
        virtualMac: vmac,
        vmid: parseInt(vmid),
      },
    });

    console.log(`Successfully provisioned VM ${vmid} for user ${userId}`);
    return service;

  } catch (error) {
    // --- CRITICAL: Rollback Logic ---
    console.error(`Provisioning failed: ${error.message}`);
    
    // Mark service as stopped/failed so admin knows
    await prisma.service.update({
        where: { id: serviceId },
        data: { status: 'STOPPED' } // Use STOPPED as a proxy for FAILED
    });

    // If the VM was created, destroy it
    if (vmid) {
      console.log(`Rollback: Destroying Proxmox VM ${vmid}...`);
      try {
        await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/stop`);
        await new Promise(resolve => setTimeout(resolve, 3000)); 
        await proxmox.delete(`/nodes/${NODE_NAME}/qemu/${vmid}`);
      } catch (e) {
          console.error("Failed to destroy VM during rollback", e);
      }
    }
    
    // If the vMAC was created, delete it
    if (vmac && ipRecord) {
      console.log(`Rollback: Deleting OVH vMAC ${vmac}...`);
      try {
        const encodedIpBlock = encodeURIComponent(ipRecord.ipBlock);
        await ovhClient.request('DELETE', `/ip/${encodedIpBlock}/virtualMac/${vmac}`);
      } catch (e) {
          console.error("Failed to delete vMAC during rollback", e);
      }
    }

    // If the IP was reserved, release it
    if (ipRecord) {
      console.log(`Rollback: Releasing IP ${ipRecord.ipAddress}...`);
      try {
        await prisma.ipAddress.update({
            where: { id: ipRecord.id },
            data: { status: 'AVAILABLE', vmid: null, virtualMac: null },
        });
      } catch (e) {
          console.error("Failed to release IP during rollback", e);
      }
    }
    
    throw new Error('Failed to provision VPS.');
  }
};

/**
 * Securely finds a VPS *only* if it's owned by the user.
 * @param {string} vmid - The VMID of the service
 * @param {string} userId - The ID of the user making the request
 */
const getOwnedVps = async (vmid, userId) => {
  const service = await prisma.service.findFirst({
    where: {
      vmid: parseInt(vmid, 10),
      userId: userId,
    },
  });

  if (!service) {
    throw new Error('VPS not found or you do not have permission to control it.');
  }
  return service;
};

/**
 * Securely sends a power command (start, stop, reboot) to a VM.
 * @param {string} vmid - The VMID to control
 * @param {string} userId - The user making the request
 * @param {'start' | 'stop' | 'reboot'} action - The power action
 */
export const controlVm = async (vmid, userId, action) => {
  // 1. Authorize: Check if the user owns this VM
  const service = await getOwnedVps(vmid, userId);

  // 2. Validate Action
  const validActions = ['start', 'stop', 'reboot'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid action specified.');
  }

  // 3. Get Node and execute command
  const { node } = service;
  try {
    const result = await proxmox.post(
      `/nodes/${node}/qemu/${vmid}/status/${action}`
    );
    
    // 4. Update status in our database (optimistic update)
    let newStatus = service.status;
    if (action === 'start') newStatus = 'RUNNING';
    if (action === 'stop') newStatus = 'STOPPED';

    if (newStatus !== service.status) {
      await prisma.service.update({
        where: { id: service.id },
        data: { status: newStatus },
      });
    }

    return { proxmoxResponse: result.data };
  } catch (error) {
    console.error(`Failed to ${action} VM ${vmid}:`, error.message);
    throw new Error(`Failed to ${action} VM.`);
  }
};
