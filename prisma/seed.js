import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding products for AMD Epyc 7351p (16c/32t)...');

  // Strategy:
  // CPU: 16 Cores / 32 Threads.
  // With KVM virtualization, you can safely oversell vCPUs by 2x-4x for shared workload tiers.
  // RAM: RAM cannot be oversold safely. Assuming you have ~128GB RAM.
  // Storage: NVMe is fast, assume ~1-2TB.

  const products = [
    {
      name: "VPS Starter",
      type: "VPS",
      description: "Perfect for personal websites, VPNs, or lightweight bots.",
      stock: -1, // Unlimited (bounded by hardware)
      specs: {
        vcpus: 1,
        ramGB: 2,
        storageGB: 25, // Generous storage is cheap on NVMe
        location: "UK (London)"
      },
      pricing: [
          { billingCycle: 'MONTHLY', price: 3.99 },
          { billingCycle: 'QUARTERLY', price: 10.99 }, // Small discount
          { billingCycle: 'ANNUALLY', price: 39.99 }   // 2 months free
      ]
    },
    {
      name: "VPS Standard",
      type: "VPS",
      description: "Our most popular plan. Great for game servers (Minecraft/FiveM small) or web apps.",
      stock: -1,
      specs: {
        vcpus: 2,
        ramGB: 4,
        storageGB: 50,
        location: "UK (London)"
      },
      pricing: [
          { billingCycle: 'MONTHLY', price: 7.99 },
          { billingCycle: 'QUARTERLY', price: 21.99 }, 
          { billingCycle: 'ANNUALLY', price: 79.99 }   
      ]
    },
    {
      name: "VPS Advanced",
      type: "VPS",
      description: "Serious power for databases, CI/CD, or larger game servers.",
      stock: -1,
      specs: {
        vcpus: 4,
        ramGB: 8,
        storageGB: 100,
        location: "UK (London)"
      },
      pricing: [
          { billingCycle: 'MONTHLY', price: 15.99 },
          { billingCycle: 'QUARTERLY', price: 44.99 }, 
          { billingCycle: 'ANNUALLY', price: 159.99 }   
      ]
    },
    {
      name: "VPS Professional",
      type: "VPS",
      description: "Dedicated-like performance for heavy workloads.",
      stock: -1,
      specs: {
        vcpus: 8,
        ramGB: 16,
        storageGB: 200,
        location: "UK (London)"
      },
      pricing: [
          { billingCycle: 'MONTHLY', price: 29.99 },
          { billingCycle: 'QUARTERLY', price: 84.99 }, 
          { billingCycle: 'ANNUALLY', price: 299.99 }   
      ]
    }
  ];

  for (const p of products) {
    // 1. Create Product
    const product = await prisma.product.create({ 
        data: {
            name: p.name,
            type: p.type,
            description: p.description,
            stock: p.stock,
            specs: p.specs
        }
    });

    // 2. Create Pricing options
    for (const priceOption of p.pricing) {
        await prisma.productPrice.create({
            data: {
                billingCycle: priceOption.billingCycle,
                price: priceOption.price,
                productId: product.id
            }
        });
    }
  }

  // Also Seed Standard OS Options
  console.log('Seeding Operating Systems...');
  const osFamilies = [
    {
        name: 'Ubuntu',
        type: 'linux',
        imageUrl: 'https://assets.ubuntu.com/v1/29985a98-ubuntu-logo32.png',
        versions: [
            { version: '22.04 LTS', proxmoxTemplateId: 9000, cloudInitUser: 'ubuntu' }
        ]
    },
    {
        name: 'Debian',
        type: 'linux',
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Openlogo-debianV2.svg/1200px-Openlogo-debianV2.svg.png',
        versions: [
            { version: '12 (Bookworm)', proxmoxTemplateId: 9001, cloudInitUser: 'debian' }
        ]
    }
  ];

  for (const os of osFamilies) {
      const createdOs = await prisma.operatingSystem.create({
          data: {
              name: os.name,
              type: os.type,
              imageUrl: os.imageUrl
          }
      });
      
      for (const ver of os.versions) {
          await prisma.osVersion.create({
              data: {
                  version: ver.version,
                  proxmoxTemplateId: ver.proxmoxTemplateId,
                  cloudInitUser: ver.cloudInitUser,
                  osId: createdOs.id
              }
          });
      }
  }

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
