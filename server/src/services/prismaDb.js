import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import config from '../config/env.js';

let pool = null;
let adapter = null;
let prismaInstance = null;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({
      connectionString: config.DATABASE_URL
    });
    pool.on('error', (err) => {
      console.error('[POSTGRES POOL ERROR]', err);
    });
  }
  return pool;
}

export async function getDb() {
  return getPool();
}

export function getPrismaClient() {
  if (!prismaInstance) {
    const p = getPool();
    adapter = new PrismaPg(p);
    prismaInstance = new PrismaClient({ adapter });
  }
  return prismaInstance;
}

export const prisma = getPrismaClient();

export default prisma;
