import type { Request } from "express";
import { getAuth as getClerkAuth } from "@clerk/express";

type ClerkAuth = ReturnType<typeof getClerkAuth>;

export function getAuth(req: Request): ClerkAuth {
  const switchClerkId = req.headers["x-switch-clerk-id"];

  if (typeof switchClerkId === "string" && switchClerkId.trim()) {
    const clerkId = switchClerkId.trim();

    return {
      userId: clerkId,
      sessionId: "switch-account-session",
      orgId: null,
      actor: null,
      sessionClaims: {
        sub: clerkId,
      },
      claims: {
        sub: clerkId,
      },
    } as unknown as ClerkAuth;
  }

  return getClerkAuth(req);
}
