import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { getAuth } from "./lib/auth";
import { ensureAuthUser } from "./lib/userSync";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: process.env.NODE_ENV === "production"
      ? publishableKeyFromHost(
          getClerkProxyHost(req) ?? "",
          process.env.CLERK_PUBLISHABLE_KEY,
        )
      : process.env.CLERK_PUBLISHABLE_KEY,
  })),
);

// Keep the selected local switch account visible to downstream handlers.
app.use((req, res, next) => {
  const switchClerkId = req.headers["x-switch-clerk-id"];
  if (switchClerkId && typeof switchClerkId === "string") {
    (req as any).switchClerkId = switchClerkId.trim();
  }
  next();
});

app.use(async (req, _res, next) => {
  try {
    const auth = getAuth(req) as {
      userId: string | null;
      sessionClaims?: Record<string, unknown>;
    };

    if (auth.userId) {
      await ensureAuthUser(auth.userId, auth.sessionClaims);
    }
  } catch (error) {
    logger.warn({ err: error }, "Failed to sync authenticated user to database");
  }

  next();
});

app.use("/api", router);

// In production, serve the built React frontend from the same Express server.
// This lets Replit expose only one port (8080 → :80 externally).
if (process.env.NODE_ENV === "production") {
  const frontendDist = path.resolve(import.meta.dirname, "../../mc-roleplay/dist/public");
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // All non-API routes fall through to the React SPA
    app.get("*", (_req, res) => {
      res.sendFile(path.join(frontendDist, "index.html"));
    });
    logger.info({ frontendDist }, "Serving static frontend");
  } else {
    logger.warn({ frontendDist }, "Frontend dist not found — skipping static file serving");
  }
}

export default app;
