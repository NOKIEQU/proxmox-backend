import { PrismaClient } from '../generated/prisma/client.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ==========================================
  // 1. SEED OPERATING SYSTEMS + VERSIONS
  // ==========================================
  const operatingSystems = [
    {
      name: 'Ubuntu',
      type: 'linux',
      versions: [
        { version: '22.04 LTS', proxmoxTemplateId: 9000, cloudInitUser: 'ubuntu' },
        { version: '24.04 LTS', proxmoxTemplateId: 9001, cloudInitUser: 'ubuntu' },
      ],
    },
    {
      name: 'Debian',
      type: 'linux',
      versions: [
        { version: '12', proxmoxTemplateId: 9002, cloudInitUser: 'debian' },
      ],
    },
    {
      name: 'AlmaLinux',
      type: 'linux',
      versions: [
        { version: '8', proxmoxTemplateId: 9003, cloudInitUser: 'almalinux' },
        { version: '9', proxmoxTemplateId: 9004, cloudInitUser: 'almalinux' },
      ],
    },
    {
      name: 'Rocky Linux',
      type: 'linux',
      versions: [
        { version: '8', proxmoxTemplateId: 9005, cloudInitUser: 'rocky' },
        { version: '9', proxmoxTemplateId: 9006, cloudInitUser: 'rocky' },
      ],
    },
    {
      name: 'CentOS Stream',
      type: 'linux',
      versions: [
        { version: '9', proxmoxTemplateId: 9007, cloudInitUser: 'centos' },
        { version: '10', proxmoxTemplateId: 9008, cloudInitUser: 'centos' },
      ],
    },
    {
      name: 'Fedora',
      type: 'linux',
      versions: [
        { version: '43', proxmoxTemplateId: 9009, cloudInitUser: 'fedora' },
      ],
    },
    {
      name: 'OpenSUSE',
      type: 'linux',
      versions: [
        { version: '15.5', proxmoxTemplateId: 9010, cloudInitUser: 'opensuse' },
        { version: '16', proxmoxTemplateId: 9011, cloudInitUser: 'opensuse' },
      ],
    },
  ];

  console.log('Loading Operating Systems and Templates...');
  for (const os of operatingSystems) {
    let osRecord = await prisma.operatingSystem.findFirst({
      where: { name: os.name },
    });

    if (!osRecord) {
      osRecord = await prisma.operatingSystem.create({
        data: {
          name: os.name,
          type: os.type,
        },
      });
    }

    for (const osVersion of os.versions) {
      const existingVersion = await prisma.osVersion.findFirst({
        where: {
          osId: osRecord.id,
          version: osVersion.version,
        },
      });

      if (!existingVersion) {
        await prisma.osVersion.create({
          data: {
            version: osVersion.version,
            proxmoxTemplateId: osVersion.proxmoxTemplateId,
            cloudInitUser: osVersion.cloudInitUser,
            osId: osRecord.id,
          },
        });
      } else {
        await prisma.osVersion.update({
          where: { id: existingVersion.id },
          data: {
            proxmoxTemplateId: osVersion.proxmoxTemplateId,
            cloudInitUser: osVersion.cloudInitUser,
          },
        });
      }
    }
  }
  console.log('✅ Seeded operating systems and OS templates.');

  // ==========================================
  // 2. SEED PRODUCTS (VPS PLANS)
  // ==========================================
  const products = [
    {
      name: 'Starter Cloud',
      description: 'Perfect for small personal projects and testing.',
      type: 'VPS',
      stock: -1,
      specs: {
        vcpus: 1,
        ramGB: 1,
        storageGB: 25,
      },
      prices: [
        { billingCycle: 'MONTHLY', price: '5.00' },
        { billingCycle: 'QUARTERLY', price: '14.00' },
        { billingCycle: 'ANNUALLY', price: '50.00' },
      ],
    },
    {
      name: 'Standard Cloud',
      description: 'Ideal for hosting web apps, blogs, and standard databases.',
      type: 'VPS',
      stock: -1,
      specs: {
        vcpus: 2,
        ramGB: 2,
        storageGB: 50,
      },
      prices: [
        { billingCycle: 'MONTHLY', price: '10.00' },
        { billingCycle: 'QUARTERLY', price: '28.00' },
        { billingCycle: 'ANNUALLY', price: '100.00' },
      ],
    },
    {
      name: 'Professional Cloud',
      description: 'High performance for production APIs and e-commerce.',
      type: 'VPS',
      stock: -1,
      specs: {
        vcpus: 4,
        ramGB: 8,
        storageGB: 100,
      },
      prices: [
        { billingCycle: 'MONTHLY', price: '20.00' },
        { billingCycle: 'QUARTERLY', price: '56.00' },
        { billingCycle: 'ANNUALLY', price: '200.00' },
      ],
    },
    {
      name: 'Enterprise Cloud',
      description: 'Massive compute power for heavy workloads and clustering.',
      type: 'VPS',
      stock: -1,
      specs: {
        vcpus: 8,
        ramGB: 16,
        storageGB: 250,
      },
      prices: [
        { billingCycle: 'MONTHLY', price: '40.00' },
        { billingCycle: 'QUARTERLY', price: '112.00' },
        { billingCycle: 'ANNUALLY', price: '400.00' },
      ],
    }
  ];

  console.log('Loading Products...');
  for (const product of products) {
    let productRecord = await prisma.product.findFirst({
      where: { name: product.name },
    });

    if (!productRecord) {
      productRecord = await prisma.product.create({
        data: {
          name: product.name,
          description: product.description,
          type: product.type,
          stock: product.stock,
          specs: product.specs,
        },
      });
    } else {
      await prisma.product.update({
        where: { id: productRecord.id },
        data: {
          description: product.description,
          type: product.type,
          stock: product.stock,
          specs: product.specs,
        },
      });
    }

    for (const productPrice of product.prices) {
      const existingPrice = await prisma.productPrice.findFirst({
        where: {
          productId: productRecord.id,
          billingCycle: productPrice.billingCycle,
        },
      });

      if (!existingPrice) {
        await prisma.productPrice.create({
          data: {
            productId: productRecord.id,
            billingCycle: productPrice.billingCycle,
            price: productPrice.price,
          },
        });
      } else {
        await prisma.productPrice.update({
          where: { id: existingPrice.id },
          data: {
            price: productPrice.price,
          },
        });
      }
    }
  }
  console.log(`✅ Seeded ${products.length} Products.`);

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error while seeding database:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });