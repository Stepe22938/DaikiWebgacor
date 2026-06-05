import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

// Load .env from workspace root if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  const rootEnvPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Ensure the database is provisioned.");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
