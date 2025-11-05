/**
 * Orchestrates the entire VPS provisioning process.
 * This is the core "robot" of your application.
 *
 * @param {object} options
 * @param {string} options.userId - The ID of the user ordering the VPS.
 * @param {string} options.productId - The ID of the product being ordered.
 * @param {string} options.hostname - The user-chosen hostname.
 * @param {string} options.sshKey - The user's public SSH key.
 * @param {string} options.userPassword - A password for the user.
 * @returns {Promise<object>} The newly created service record from the database.
 */
export const provisionNewVps = async ({
  userId,
  productId,
  hostname,
  sshKey,
  userPassword, // We'll generate a random password for the 'ubuntu' user
}) => {
  let ipRecord, vmac, vmid;

  // --- Hardcoded values (you should get these from the product) ---
  const TEMPLATE_ID = 9000; // The ID of your master template
  const NODE_NAME = 'ns3191007'; // Your Proxmox node name (from your screenshot)
  const BRIDGE_NAME = 'vmbr0'; // Your public bridge
  const DEFAULT_USER = 'ubuntu';

  try {
    // --- Step 1: Get Product & User Info ---
    console.log(`Starting provisioning for user ${userId} with product ${productId}`);
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new Error('Product not found');
    
    // Get product specs. We must use a type assertion
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
    // We must URL-encode the IP block (e.g., "1.2.3.4/29" -> "1.2.3.4%2F29")
    const encodedIpBlock = encodeURIComponent(ipRecord.ipBlock);
    
    console.log(`Calling OVH API to create vMAC for IP block ${ipRecord.ipBlock}...`);
    
    const vmacResponse = await ovhClient.request('POST', `/ip/${encodedIpBlock}/virtualMac`, {
      ipAddress: ipRecord.ipAddress, // The specific IP to attach
      type: 'ovh',                   // The type for Proxmox/KVM
      vmName: hostname,
    });
    
    vmac = vmacResponse.macAddress; // e.g., '00:50:56:xx:xx:xx'
    console.log(`Successfully created vMAC ${vmac} for ${ipRecord.ipAddress}`);

    // --- Step 4: Call Proxmox API to Create VM ---
    console.log('Finding next available VMID...');
    const nextIdResponse = await proxmox.get(`/nodes/${NODE_NAME}/nextid`);
    vmid = nextIdResponse.data;
    console.log(`Next available VMID is ${vmid}`);
    
    // 4a. Clone the template
    console.log(`Cloning template ${TEMPLATE_ID} to new VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${TEMPLATE_ID}/clone`, {
      newid: vmid,
      name: hostname,
      full: true, // We must do a full clone
    });

    // 4b. Configure the VM's hardware (vMAC, CPU, RAM)
    console.log(`Configuring VM ${vmid} hardware...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      cores: specs.vcpus,
      memory: specs.ramGB * 1024, // Proxmox wants RAM in MiB
      net0: `virtio=${vmac},bridge=${BRIDGE_NAME}`, // Set the vMAC
    });
    
    // 4c. Resize the disk
    console.log(`Resizing disk to ${specs.storageGB}G...`);
    await proxmox.put(`/nodes/${NODE_NAME}/qemu/${vmid}/resize`, {
      disk: 'scsi0', // The disk from our template
      size: `${specs.storageGB}G`,
    });

    // 4d. Configure Cloud-Init (IP, user, ssh key)
    console.log(`Setting Cloud-Init config for VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/config`, {
      ciuser: DEFAULT_USER,
      cipassword: userPassword, // Pass in the password
      sshkeys: sshKey,         // Pass in the SSH key
      ipconfig0: `ip=${ipRecord.ipAddress}/32,gw=${ipRecord.gateway}`,
    });

    // 4e. Start the VM!
    console.log(`Starting VM ${vmid}...`);
    await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/start`);

    // --- Step 5: Create Order and Service in Database ---
    console.log(`Finalizing database records for user ${userId}...`);
    
    // Create the Order
    const order = await prisma.order.create({
      data: {
        totalAmount: product.price,
        status: 'ACTIVE',
        userId: userId,
        productId: productId,
        paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Create the Service and link it to the Order and IP
    const service = await prisma.service.create({
      data: {
        hostname: hostname,
        status: 'RUNNING',
        os: 'Ubuntu 22.04', // You can get this from the Product model later
        vmid: vmid,
        node: NODE_NAME,
        userId: userId,
        orderId: order.id,
        ipAddressId: ipRecord.id,
      },
    });
    
    // --- Step 6: Finalize IP Address Record ---
    await prisma.ipAddress.update({
      where: { id: ipRecord.id },
      data: {
        status: 'IN_USE',
        virtualMac: vmac,
        vmid: vmid,
      },
    });

    console.log(`Successfully provisioned VM ${vmid} for user ${userId}`);
    return service;

  } catch (error) {
    // --- CRITICAL: Rollback Logic ---
    console.error(`Provisioning failed: ${error.message}`);
    
    // If the VM was created, destroy it
    if (vmid) {
      console.log(`Rollback: Destroying Proxmox VM ${vmid}...`);
      await proxmox.post(`/nodes/${NODE_NAME}/qemu/${vmid}/status/stop`);
      // Wait a moment for it to stop
      await new Promise(resolve => setTimeout(resolve, 3000)); 
      await proxmox.delete(`/nodes/${NODE_NAME}/qemu/${vmid}`);
    }
    
    // If the vMAC was created, delete it
    if (vmac && ipRecord) {
      console.log(`Rollback: Deleting OVH vMAC ${vmac}...`);
      const encodedIpBlock = encodeURIComponent(ipRecord.ipBlock);
      await ovhClient.request('DELETE', `/ip/${encodedIpBlock}/virtualMac/${vmac}`);
    }

    // If the IP was reserved, release it
    if (ipRecord) {
      console.log(`Rollback: Releasing IP ${ipRecord.ipAddress}...`);
      await prisma.ipAddress.update({
        where: { id: ipRecord.id },
        data: { status: 'AVAILABLE', vmid: null, virtualMac: null },
      });
    }
    
    // Throw a user-friendly error
    throw new Error('Failed to provision VPS. Please try again later or contact support.');
  }
};