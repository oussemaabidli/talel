import 'dotenv/config';
import { PrismaClient, Prisma, PartCondition, RequestStatus } from '@prisma/client';

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEMO_FIXTURES !== 'true') {
  throw new Error('Development fixtures require ALLOW_DEMO_FIXTURES=true and are disabled in production.');
}

const prisma = new PrismaClient();
const fixtures = [
  { id: 'dev-request-renault-clio-brake', partName: 'Front brake pads', category: 'Mechanical', oemReference: 'DEV-OEM-CLIO-01', brand: 'Renault', vehicleMake: 'Renault', vehicleModel: 'Clio', vehicleYear: 2020, condition: PartCondition.NEW, quantity: 1, minBudget: '80.000', maxBudget: '160.000', location: 'Tunis', description: '[DEVELOPMENT FIXTURE] Synthetic sample marketplace request. Not a live customer request.', status: RequestStatus.PUBLISHED },
  { id: 'dev-request-peugeot-filter', partName: 'Oil filter', category: 'Filters', oemReference: 'DEV-OEM-208-02', brand: 'Peugeot', vehicleMake: 'Peugeot', vehicleModel: '208', vehicleYear: 2019, condition: PartCondition.EITHER, quantity: 2, minBudget: '15.000', maxBudget: '45.000', location: 'Sfax', description: '[DEVELOPMENT FIXTURE] Synthetic sample marketplace request. Not a live customer request.', status: RequestStatus.PUBLISHED },
];

try {
  for (const fixture of fixtures) {
    await prisma.marketplaceRequest.upsert({ where: { id: fixture.id }, create: { ...fixture, minBudget: new Prisma.Decimal(fixture.minBudget), maxBudget: new Prisma.Decimal(fixture.maxBudget) }, update: {} });
  }
  console.info(`Upserted ${fixtures.length} explicitly labeled development request fixtures.`);
} finally { await prisma.$disconnect(); }
