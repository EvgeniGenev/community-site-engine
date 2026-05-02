import { RoleSchema, UsersSchema, type Role, type User } from "@community-site-engine/shared";
import { createPublicKey, verify } from "node:crypto";
import { config } from "./config.js";
import type { StorageDriver } from "./storage.js";

const fallbackUsers: User[] = [
  { id: "admin", name: "Admin", role: "admin", token: config.adminToken },
  { id: "designer", name: "Designer", role: "designer", token: "dev-designer-token" },
  { id: "contributor", name: "Contributor", role: "contributor", token: "dev-contributor-token" }
];

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
  [key: string]: unknown;
}

let jwksCache: { expiresAt: number; keys: Jwk[] } | null = null;

function base64UrlDecode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString("utf8")) as T;
}

function cognitoRegion() {
  return config.cognitoRegion ?? config.cognitoUserPoolId?.split("_")[0];
}

function cognitoIssuer() {
  const region = cognitoRegion();
  if (!region || !config.cognitoUserPoolId) return null;
  return `https://cognito-idp.${region}.amazonaws.com/${config.cognitoUserPoolId}`;
}

async function getJwks() {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const issuer = cognitoIssuer();
  if (!issuer) throw new Error("Cognito issuer is not configured");
  const response = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!response.ok) throw new Error(`Could not fetch Cognito JWKS: ${response.status}`);
  const body = await response.json() as { keys?: Jwk[] };
  jwksCache = { keys: body.keys ?? [], expiresAt: Date.now() + 60 * 60 * 1000 };
  return jwksCache.keys;
}

async function authenticateCognitoJwt(token: string): Promise<AuthUser | null> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
  const header = parseJwtPart<{ alg?: string; kid?: string }>(encodedHeader);
  if (header.alg !== "RS256" || !header.kid) return null;
  const key = (await getJwks()).find((item) => item.kid === header.kid);
  if (!key) return null;
  const verified = verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    createPublicKey({ key, format: "jwk" }),
    base64UrlDecode(encodedSignature)
  );
  if (!verified) return null;

  const payload = parseJwtPart<Record<string, unknown>>(encodedPayload);
  const issuer = cognitoIssuer();
  if (!issuer || payload.iss !== issuer) return null;
  const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  if (!expiresAt || expiresAt <= Date.now()) return null;
  const tokenUse = String(payload.token_use ?? "");
  if (tokenUse !== "id" && tokenUse !== "access") return null;
  if (config.cognitoAppClientId) {
    const audience = payload.aud ?? payload.client_id;
    if (audience !== config.cognitoAppClientId) return null;
  }

  const parsedRole = RoleSchema.safeParse(payload["custom:role"]);
  const role = parsedRole.success ? parsedRole.data : "contributor";
  return {
    id: String(payload["cognito:username"] ?? payload.username ?? payload.sub ?? ""),
    name: String(payload.name ?? payload.email ?? payload["cognito:username"] ?? payload.username ?? "CMS User"),
    role
  };
}

async function authenticateLocalToken(storage: StorageDriver, token: string): Promise<AuthUser | null> {
  const raw = await storage.get("settings/users.json");
  const users = raw ? UsersSchema.parse(JSON.parse(raw)) : fallbackUsers;
  const user = users.find((item) => item.token === token);
  return user ? { id: user.id, name: user.name, role: user.role } : null;
}

export async function authenticate(storage: StorageDriver, authorization?: string): Promise<AuthUser | null> {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  if (config.cognitoUserPoolId) {
    const cognitoUser = await authenticateCognitoJwt(token).catch(() => null);
    if (cognitoUser) return cognitoUser;
    return config.allowDevTokens ? authenticateLocalToken(storage, token) : null;
  }

  return authenticateLocalToken(storage, token);
}

export function can(role: Role, action: "read" | "writeContent" | "writeStructure" | "delete" | "media" | "settings") {
  RoleSchema.parse(role);
  if (role === "admin") return true;
  if (role === "designer") return action !== "settings";
  return action === "read" || action === "writeContent" || action === "delete" || action === "media";
}
