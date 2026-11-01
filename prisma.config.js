import { defineConfig } from 'prisma/config';

// Load local .env in development if DATABASE_URL is not already set in environment
if (!process.env.DATABASE_URL) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile();
    }
  } catch {
    // In production (Render) or if .env does not exist, environment variables are already in process.env
  }
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://placeholder:placeholder@localhost:5432/placeholder'
  }
});

