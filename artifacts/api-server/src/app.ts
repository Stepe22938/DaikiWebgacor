import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { eq } from "drizzle-orm";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
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
  const host = req.headers.host?.toLowerCase() ?? "";
  const isLocalHost =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("0.0.0.0");

  if (process.env.NODE_ENV === "production" || !isLocalHost) {
    next();
    return;
  }

  try {
    const localDevClerkId = "local_dev_user";
    let localDevUser = await db.query.usersTable.findFirst({
      where: eq(usersTable.clerkId, localDevClerkId),
    });

    if (!localDevUser) {
      const [created] = await db.insert(usersTable).values({
        clerkId: localDevClerkId,
        username: "localdev",
        userTag: "#999",
        displayName: "Local Dev",
        role: "dev_website",
        mcUsername: "LocalDev",
        messagePrivacy: "everyone",
      }).returning();
      localDevUser = created;
    }

    if (!(req as any).switchClerkId) {
      (req as any).switchClerkId = localDevUser.clerkId;
    }
  } catch (error) {
    logger.warn({ err: error }, "Failed to bootstrap local dev auth user");
  }

  next();
});

app.use("/api", router);

export default app;
