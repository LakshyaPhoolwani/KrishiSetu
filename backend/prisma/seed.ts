import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.crop.upsert({
    where: { id: 'demo-crop-wheat' },
    update: {},
    create: { id: 'demo-crop-wheat', name: 'Wheat', category: 'Cereal', season: 'Rabi' },
  });
  await prisma.crop.upsert({
    where: { id: 'demo-crop-soybean' },
    update: {},
    create: { id: 'demo-crop-soybean', name: 'Soybean', category: 'Oilseed', season: 'Kharif' },
  });
  await prisma.market.upsert({
    where: { id: 'demo-market-bhopal' },
    update: {},
    create: { id: 'demo-market-bhopal', name: 'Bhopal Mandi', district: 'Bhopal', state: 'Madhya Pradesh', latitude: 23.2599, longitude: 77.4126 },
  });
  await prisma.market.upsert({
    where: { id: 'demo-market-indore' },
    update: {},
    create: { id: 'demo-market-indore', name: 'Indore Mandi', district: 'Indore', state: 'Madhya Pradesh', latitude: 22.7196, longitude: 75.8577 },
  });
  console.log('Demo markets and crops seeded. Run the admin demo ingestion endpoint to add demo prices.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
