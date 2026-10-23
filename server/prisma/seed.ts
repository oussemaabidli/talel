import 'dotenv/config';
import { PrismaClient, Prisma, PartCondition, RequestStatus } from '@prisma/client';

const prisma = new PrismaClient();

const categories = [
  { id: 'cat-01', name: 'Brake System', icon: 'disc', description: 'Brake pads, rotors, calipers, and lines' },
  { id: 'cat-02', name: 'Engine Parts', icon: 'cog', description: 'Engine components and accessories' },
  { id: 'cat-03', name: 'Filters', icon: 'filter', description: 'Air, oil, fuel, and cabin filters' },
  { id: 'cat-04', name: 'Suspension', icon: 'arrow-up-down', description: 'Shocks, struts, springs, and bushings' },
  { id: 'cat-05', name: 'Electrical', icon: 'zap', description: 'Batteries, alternators, starters, sensors' },
  { id: 'cat-06', name: 'Body Parts', icon: 'car', description: 'Bumpers, fenders, doors, mirrors' },
  { id: 'cat-07', name: 'Lighting', icon: 'lightbulb', description: 'Headlights, taillights, signal lights' },
  { id: 'cat-08', name: 'Cooling System', icon: 'thermometer', description: 'Radiators, water pumps, thermostats' },
  { id: 'cat-09', name: 'Transmission', icon: 'settings', description: 'Clutches, gears, transmission parts' },
  { id: 'cat-10', name: 'Exhaust System', icon: 'wind', description: 'Mufflers, catalytic converters, pipes' },
  { id: 'cat-11', name: 'Interior Parts', icon: 'layout', description: 'Seats, trim, dashboard components' },
  { id: 'cat-12', name: 'Steering', icon: 'circle', description: 'Power steering, rack, tie rods' },
];

try {
  for (const cat of categories) {
    await prisma.marketplaceCategory.upsert({
      where: { name: cat.name },
      create: { ...cat, isActive: true },
      update: {},
    });
  }
  console.info(`Upserted ${categories.length} marketplace categories.`);
} finally {
  await prisma.$disconnect();
}
