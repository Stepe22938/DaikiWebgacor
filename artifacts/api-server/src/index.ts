import path from "node:path";
import fs from "node:fs";

// Load .env from workspace root before any other module loads
const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
if (fs.existsSync(rootEnvPath)) {
  process.loadEnvFile(rootEnvPath);
}

// Dynamically import modules so environment variables are available during module loading
const app = (await import("./app")).default;
const { logger } = await import("./lib/logger");

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("uncaughtException", (err) => {
  logger.error({ err }, "Uncaught exception");
});

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
