import prisma from './prisma.service.js';
import proxmox from './proxmox.service.js';
import crypto from 'crypto';
// --- Configuration ---
const NODE_NAME = 'snaphosting'; // Your Proxmox node name
const BRIDGE_NAME = 'vmbr0';   // Your public bridge
const DEFAULT_USER = 'ubuntu'; // Default CI User (fallback)
import * as emailService from './email.service.js';

/**
 * Creates the initial database entry for a service immediately after payment.
 */
export const createServiceEntry = async ({
  userId,
  productId,
  hostname,
  osVersionId,
  stripeSubscriptionId,
  amount,
  location
}) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Product not found');

  const osVersion = await prisma.osVersion.findUnique({ where: { id: osVersionId } });
  if (!osVersion) throw new Error("CRITICAL: Invalid OS Version in webhook payload.");

  const order = await prisma.order.create({
    data: {
      totalAmount: amount,
      status: 'ACTIVE',
      userId: userId,
      productId: productId,
      paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripeSubscriptionId: stripeSubscriptionId
    },
  });

  const service = await prisma.service.create({
    data: {
      hostname: hostname,
      status: 'BUILDING',
      osVersionId: osVersion.id,
      userId: userId,
      orderId: order.id,
      location: location
    },
  });

  return service;
};

/**
 * Orchestrates the VPS provisioning process for an EXISTING service entry.
 */
export const provisionNewVps = async (serviceId, { sshKey, userPassword }) => {
  let ipRecord, vmid, vmac;

  try {
    // --- Step 1: Get Service & Product Info ---
    console.log(`Starting provisioning for service ${serviceId}`);
    console.log("here 1")
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        order: { include: { product: true } },
        osVersion: true
      }
    });

    if (!service) throw new Error('Service not found');
    const product = service.order.product;
    const { hostname, userId, osVersion, location: userLocationId } = service;

    if (!osVersion) throw new Error("Service has no associated OS Version!");

    const templateId = osVersion.proxmoxTemplateId;
    const ciUser = osVersion.cloudInitUser || DEFAULT_USER;
    const specs = product.specs;
    console.log("here 2")
    // --- Step 2: Find & Reserve a Free IP (and grab its pre-set vMAC) ---
    const locationRecord = await prisma.location.findUnique({
      where: { id: userLocationId }
    });

    if (!locationRecord) throw new Error(`CRITICAL: Location record not found for ID: ${userLocationId}`);
    console.log("here 3")

    const targetLocationName = locationRecord.name;

    console.log(`Searching for available IP in ${targetLocationName}...`);
    console.log("here 4")
    ipRecord = await prisma.ipAddress.findFirst({
      where: { status: 'AVAILABLE', location: targetLocationName },
    });

    if (!ipRecord) throw new Error(`No available IP addresses in ${targetLocationName}.`);
    // CRITICAL: Ensure the admin actually set the vMAC in the database!
    if (!ipRecord.virtualMac) {
      throw new Error(`CRITICAL SYSTEM ERROR: IP ${ipRecord.ipAddress} is marked available, but has no virtualMac in the database! Admin must set this manually via Prisma Studio.`);
    }
    vmac = ipRecord.virtualMac;

    await prisma.ipAddress.update({
      where: { id: ipRecord.id },
      data: { status: 'RESERVED' },
    });
    console.log(`Reserved IP: ${ipRecord.ipAddress} with pre-configured vMAC: ${vmac}`);
    console.log("here 6")

    // --- Step 3: Call Proxmox API to Create VM ---
    console.log('Finding next available VMID...');
    const nextIdResponse = await proxmox.get(`/cluster/nextid`);
    vmid = nextIdResponse.data;
    console.log("here 7")
    console.log(`Next available VMID is ${vmid}`);

    // Clone the template
    console.log(`Cloning template ${templateId} to new VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${templateId}/clone`, {
      newid: vmid,
      name: hostname,
      full: 1,
    });
    console.log("here 8")
    // Configure the VM's hardware (injecting the vMAC from the DB)
    console.log(`Configuring VM ${vmid} hardware...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      cores: specs.vcpus,
      memory: specs.ramGB * 1024,
      net0: `virtio=${vmac},bridge=${BRIDGE_NAME}`,
      agent: 1
    });
    console.log("here 9")
    // Resize the disk
    console.log(`Resizing disk to ${specs.storageGB}G...`);
    await proxmox.put(`/nodes/${NODE_NAME}/qemu/${vmid}/resize`, {
      disk: 'scsi0',
      size: `${specs.storageGB}G`,
    });
    console.log("here 9")
    // Configure Cloud-Init 
    console.log(`Setting Cloud-Init config for VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      ciuser: ciUser,
      cipassword: userPassword,
      sshkeys: encodeURIComponent(sshKey),
      ipconfig0: `ip=${ipRecord.ipAddress}/32,gw=${ipRecord.gateway}`,
    });
    console.log("here 10")
    // Start the VM!
    console.log(`Starting VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/start`);

    // --- Step 4: Update Service and IP in Database ---
    console.log(`Finalizing database records for service ${service.id}...`);

    await prisma.service.update({
      where: { id: service.id },
      data: {
        status: 'RUNNING',
        vmid: parseInt(vmid),
        node: NODE_NAME,
        ipAddressId: ipRecord.id,
      },
    });

    await prisma.ipAddress.update({
      where: { id: ipRecord.id },
      data: { status: 'IN_USE' }, // No need to update vmac here, it's already there
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await emailService.sendServerReadyEmail(
        user.email, 
        hostname, 
        ipRecord.ipAddress, 
        userPassword
      );
    }

    console.log(`🎉 Successfully provisioned VM ${vmid} for user ${userId}`);
    return service;

  } catch (error) {
    // --- CRITICAL: Rollback Logic ---
    console.error(`Provisioning failed:`, error.message || JSON.stringify(error));

    await prisma.service.update({
      where: { id: serviceId },
      data: { status: 'STOPPED' }
    });

    if (vmid) {
      console.log(`Rollback: Destroying Proxmox VM ${vmid}...`);
      try {
        await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/stop`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        await proxmox.delete(`/nodes/${NODE_NAME}/qemu/${vmid}`);
      } catch (e) {
        console.error("Failed to destroy VM during rollback", e.message || JSON.stringify(e));
      }
    }

    if (ipRecord) {
      console.log(`Rollback: Releasing IP ${ipRecord.ipAddress}...`);
      try {
        await prisma.ipAddress.update({
          where: { id: ipRecord.id },
          data: { status: 'AVAILABLE' }, // IMPORTANT: We do NOT set virtualMac to null here anymore!
        });
      } catch (e) {
        console.error("Failed to release IP during rollback", e.message || JSON.stringify(e));
      }
    }

    throw new Error('Failed to provision VPS.');
  }
};

/**
 * Returns all VPS services owned by a user, including product and IP details.
 */
export const findUserServices = async (userId) => {
  return prisma.service.findMany({
    where: { userId },
    include: {
      ipAddress: true,
      order: {
        include: {
          product: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

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

export const controlVm = async (vmid, userId, action) => {
  const service = await getOwnedVps(vmid, userId);

  const validActions = ['start', 'stop', 'reboot'];
  if (!validActions.includes(action)) {
    throw new Error('Invalid action specified.');
  }

  const { node } = service;
  try {
    const result = await proxmox.post(
      `/nodes/${node}/qemu/${vmid}/status/${action}`
    );

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

/**
 * Securely fetches live performance stats for a VM.
 * @param {string} vmid - The VMID to check
 * @param {string} userId - The user making the request
 */
export const getVpsStats = async (vmid, userId) => {
  // 1. Authorize: Check if the user owns this VM
  const service = await getOwnedVps(vmid, userId);
  const { node } = service;

  try {
    // 2. Get the base hypervisor stats
    const result = await proxmox.get(`/nodes/${node}/qemu/${vmid}/status/current`);
    let stats = result.data;

    // 3. Ask the Guest Agent for the ACTUAL file system usage
    if (stats.status === 'running') {
      try {
        const fsResponse = await proxmox.get(`/nodes/${node}/qemu/${vmid}/agent/get-fsinfo`);
        // Extract the result array from the Proxmox response
        const fileSystems = fsResponse.data.result || fsResponse.data;

        if (Array.isArray(fileSystems)) {
          // Look for the primary root drive where Linux is installed ('/')
          const rootFs = fileSystems.find(fs => fs.mountpoint === '/');
          if (rootFs) {
            // Overwrite the hypervisor's 0 value with the real byte count!
            stats.disk = rootFs['used-bytes'];
          }
        }
      } catch (agentErr) {
        // If the agent is turned off or booting up, fail silently and keep the UI stable
        console.log(`Agent not ready on VM ${vmid}, falling back to default stats.`);
      }
    }

    return stats;
  } catch (error) {
    console.error(`Failed to fetch stats for VM ${vmid}:`, error.message);
    throw new Error(`Failed to fetch VM stats.`);
  }
};

/**
 * Wipes and reinstalls the VPS using its original OS template.
 * Destroys the VM, re-clones it, and assigns the provided SSH Key.
 */
// 🚀 FIXED: Added sshKey parameter
export const reinstallVps = async (vmid, userId, sshKey) => {
  // 1. Authorize user
  const service = await getOwnedVps(vmid, userId);

  // 2. Fetch full specs (IP, MAC, OS Template, RAM, etc)
  const fullService = await prisma.service.findUnique({
    where: { id: service.id },
    include: {
      order: { include: { product: true } },
      osVersion: true,
      ipAddress: true
    }
  });

  const { hostname, osVersion, ipAddress, order } = fullService;
  const templateId = osVersion.proxmoxTemplateId;
  const ciUser = osVersion.cloudInitUser || DEFAULT_USER;
  const specs = order.product.specs;
  const vmac = ipAddress.virtualMac;

  // 🚀 DELETED: No more random password generation

  try {
    // 3. Stop the VM
    console.log(`Stopping VM ${vmid} for reinstall...`);
    try { await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/stop`); } catch (e) { }
    await new Promise(res => setTimeout(res, 5000)); // Give Proxmox time to stop

    // 4. Destroy the VM
    console.log(`Destroying VM ${vmid}...`);
    await proxmox.delete(`/nodes/${NODE_NAME}/qemu/${vmid}`);
    await new Promise(res => setTimeout(res, 5000)); // Give Proxmox time to unlock disk

    // 5. Clone fresh template
    console.log(`Cloning fresh template ${templateId} to VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${templateId}/clone`, {
      newid: vmid,
      name: hostname,
      full: 1,
    });

    // 6. Configure hardware
    console.log(`Configuring hardware for VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      cores: specs.vcpus,
      memory: specs.ramGB * 1024,
      net0: `virtio=${vmac},bridge=${BRIDGE_NAME}`,
      agent: 1
    });

    // 7. Resize disk
    console.log(`Resizing disk...`);
    await proxmox.put(`/nodes/${NODE_NAME}/qemu/${vmid}/resize`, {
      disk: 'scsi0',
      size: `${specs.storageGB}G`,
    });

    // 8. Cloud-Init (Inject SSH Key & old IP)
    console.log(`Setting Cloud-Init...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      ciuser: ciUser,
      sshkeys: encodeURIComponent(sshKey), // 🚀 FIXED: Injects the provided SSH key
      ipconfig0: `ip=${ipAddress.ipAddress}/32,gw=${ipAddress.gateway}`,
    });

    // 9. Start VM
    console.log(`Starting freshly formatted VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/start`);

    // 🚀 FIXED: Return a simple success message
    return { success: true, message: "Server formatting initiated." };

  } catch (error) {
    console.error(`Reinstall failed for VM ${vmid}:`, error.response?.data || error.message);
    throw new Error(`Failed to format and reinstall VPS.`);
  }
};