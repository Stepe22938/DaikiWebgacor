import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import path from "node:path";
import fs from "node:fs";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
  if (fs.existsSync(rootEnvPath)) {
    try {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(rootEnvPath);
      }
    } catch (e) {
      console.warn("Failed to load .env file via loadEnvFile:", e);
    }
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
