import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild, context } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm } from "node:fs/promises";
import { spawn, execSync } from "node:child_process";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

function killPortProcess(port) {
  try {
    let stdout;
    if (process.platform === "win32") {
      stdout = execSync(`netstat -ano | findstr :${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString();
      const lines = stdout.split("\n");
      for (const line of lines) {
        if (line.includes("LISTENING")) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && pid !== "0") {
            console.log(`[API-Build] Port ${port} is in use by PID ${pid}. Killing it...`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
          }
        }
      }
    } else {
      stdout = execSync(`lsof -t -i:${port}`, { stdio: ["pipe", "pipe", "ignore"] }).toString();
      const pids = stdout.split("\n").filter(Boolean);
      for (const pid of pids) {
        console.log(`[API-Build] Port ${port} is in use by PID ${pid}. Killing it...`);
        execSync(`kill -9 ${pid}`, { stdio: "ignore" });
      }
    }
  } catch (err) {
    // Port not in use or netstat/lsof failed
  }
}

let child = null;
let childRunning = false;

const runServerPlugin = {
  name: "run-server",
  setup(build) {
    build.onEnd(() => {
      const spawnNew = () => {
        console.log("[API-Build] Starting API server...");
        child = spawn("node", ["--enable-source-maps", "./dist/index.mjs"], {
          stdio: "inherit"
        });
        childRunning = true;
        child.on("exit", (code) => {
          childRunning = false;
          if (code !== 0 && code !== null) {
            console.error(`[API-Build] API server exited with code ${code}`);
          }
        });
      };

      if (child && childRunning) {
        console.log("[API-Build] Restarting API server...");
        child.once("exit", () => {
          spawnNew();
        });
        child.kill();
      } else {
        spawnNew();
      }
    });
  }
};

process.on("exit", () => {
  if (child) child.kill();
});
process.on("SIGINT", () => {
  if (child) child.kill();
  process.exit(0);
});
process.on("SIGTERM", () => {
  if (child) child.kill();
  process.exit(0);
});

async function buildAll() {
  const watchMode = process.argv.includes("--watch");

  // Clean stale ports to avoid conflict
  killPortProcess(5000);

  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  const esbuildOptions = {
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    // Some packages may not be bundleable, so we externalize them, we can add more here as needed.
    // Some of the packages below may not be imported or installed, but we're adding them in case they are in the future.
    // Examples of unbundleable packages:
    // - uses native modules and loads them dynamically (e.g. sharp)
    // - use path traversal to read files (e.g. @google-cloud/secret-manager loads sibling .proto files)
    external: [
      "*.node",
      "sharp",
      "better-sqlite3",
      "sqlite3",
      "canvas",
      "bcrypt",
      "argon2",
      "fsevents",
      "re2",
      "farmhash",
      "xxhash-addon",
      "bufferutil",
      "utf-8-validate",
      "ssh2",
      "cpu-features",
      "dtrace-provider",
      "isolated-vm",
      "lightningcss",
      "pg-native",
      "oracledb",
      "mongodb-client-encryption",
      "nodemailer",
      "handlebars",
      "knex",
      "typeorm",
      "protobufjs",
      "onnxruntime-node",
      "@tensorflow/*",
      "@prisma/client",
      "@mikro-orm/*",
      "@grpc/*",
      "@swc/*",
      "@aws-sdk/*",
      "@azure/*",
      "@opentelemetry/*",
      "@google-cloud/*",
      "@google/*",
      "googleapis",
      "firebase-admin",
      "@parcel/watcher",
      "@sentry/profiling-node",
      "@tree-sitter/*",
      "aws-sdk",
      "classic-level",
      "dd-trace",
      "ffi-napi",
      "grpc",
      "hiredis",
      "kerberos",
      "leveldown",
      "miniflare",
      "mysql2",
      "newrelic",
      "odbc",
      "piscina",
      "realm",
      "ref-napi",
      "rocksdb",
      "sass-embedded",
      "sequelize",
      "serialport",
      "snappy",
      "tinypool",
      "usb",
      "workerd",
      "wrangler",
      "zeromq",
      "zeromq-prebuilt",
      "playwright",
      "puppeteer",
      "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it
      esbuildPluginPino({ transports: ["pino-pretty"] }),
      ...(watchMode ? [runServerPlugin] : [])
    ],
    // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  };

  if (watchMode) {
    console.log("[API-Build] Running esbuild in watch mode...");
    const ctx = await context(esbuildOptions);
    await ctx.watch();
  } else {
    await esbuild(esbuildOptions);
  }
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
