import { PrismaClient } from '@prisma/client';

// Reuse Prisma client across lambda invocations to avoid too many connections
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prisma = global.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.prisma = prisma;

export default prisma;
