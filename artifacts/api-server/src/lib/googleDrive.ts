import fs from "node:fs";
import crypto from "node:crypto";

type DriveToken = {
  accessToken: string;
  expiresAt: number;
};

type DriveUploadInput = {
  filePath: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type DriveUploadResult = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  webViewLink?: string;
  webContentLink?: string;
};

let cachedToken: DriveToken | null = null;

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getPrivateKey() {
  return (process.env["GOOGLE_DRIVE_PRIVATE_KEY"] ?? "").replace(/\\n/g, "\n");
}

function requireDriveConfig() {
  const oauthClientId = process.env["GOOGLE_DRIVE_OAUTH_CLIENT_ID"];
  const oauthClientSecret = process.env["GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"];
  const oauthRefreshToken = process.env["GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN"];
  if (oauthClientId && oauthClientSecret && oauthRefreshToken) {
    return {
      authMode: "oauth" as const,
      oauthClientId,
      oauthClientSecret,
      oauthRefreshToken,
      folderId: process.env["GOOGLE_DRIVE_FOLDER_ID"] || undefined,
    };
  }

  const clientEmail = process.env["GOOGLE_DRIVE_CLIENT_EMAIL"];
  const privateKey = getPrivateKey();
  if (!clientEmail || !privateKey) {
    throw new Error("Google Drive is not configured. Set OAuth refresh token envs or service account envs.");
  }
  return {
    authMode: "service-account" as const,
    clientEmail,
    privateKey,
    folderId: process.env["GOOGLE_DRIVE_FOLDER_ID"] || undefined,
  };
}

async function getDriveAccessToken() {
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.accessToken;
  }

  const config = requireDriveConfig();
  if (config.authMode === "oauth") {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.oauthClientId,
        client_secret: config.oauthClientSecret,
        refresh_token: config.oauthRefreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!response.ok || !data.access_token) {
      throw new Error(`Google OAuth token failed: ${data.error_description || data.error || response.statusText}`);
    }
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000),
    };
    return cachedToken.accessToken;
  }

  const { clientEmail, privateKey } = config;
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive.file",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claim}`;
  const signature = crypto.sign("RSA-SHA256", Buffer.from(unsigned), privateKey);
  const assertion = `${unsigned}.${base64Url(signature)}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(`Google token failed: ${data.error_description || data.error || response.statusText}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000),
  };
  return cachedToken.accessToken;
}

export async function uploadFileToDrive(input: DriveUploadInput): Promise<DriveUploadResult> {
  const { folderId } = requireDriveConfig();
  const accessToken = await getDriveAccessToken();
  const metadata: Record<string, unknown> = {
    name: input.fileName,
  };
  if (folderId) metadata["parents"] = [folderId];

  const sessionResponse = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType,
        "X-Upload-Content-Length": String(input.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  const uploadUrl = sessionResponse.headers.get("location");
  if (!sessionResponse.ok || !uploadUrl) {
    const text = await sessionResponse.text().catch(() => "");
    throw new Error(`Google Drive upload session failed: ${sessionResponse.status} ${text.slice(0, 180)}`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": input.mimeType,
      "Content-Length": String(input.size),
    },
    body: fs.createReadStream(input.filePath) as any,
    duplex: "half",
  } as RequestInit);
  const data = await uploadResponse.json().catch(() => ({})) as Partial<DriveUploadResult> & { error?: { message?: string } };
  if (!uploadResponse.ok || !data.id) {
    throw new Error(`Google Drive upload failed: ${data.error?.message || uploadResponse.statusText}`);
  }

  return {
    id: data.id,
    name: data.name ?? input.fileName,
    mimeType: data.mimeType ?? input.mimeType,
    size: Number(data.size ?? input.size),
    webViewLink: data.webViewLink,
    webContentLink: data.webContentLink,
  };
}

export async function getDriveDownloadResponse(fileId: string) {
  const accessToken = await getDriveAccessToken();
  return fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
