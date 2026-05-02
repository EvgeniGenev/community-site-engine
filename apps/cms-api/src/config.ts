export type StorageMode = "local" | "s3";

export const config = {
  port: Number(process.env.PORT ?? "8787"),
  storageMode: (process.env.STORAGE_MODE ?? "local") as StorageMode,
  contentRoot: process.env.CONTENT_ROOT ?? "../../site-assets/content",
  adminToken: process.env.CMS_ADMIN_TOKEN ?? "dev-admin-token",
  s3Bucket: process.env.CMS_CONTENT_BUCKET,
  s3Prefix: process.env.CMS_CONTENT_PREFIX ?? "",
  cognitoUserPoolId: process.env.COGNITO_USER_POOL_ID,
  cognitoRegion: process.env.COGNITO_REGION,
  cognitoAppClientId: process.env.COGNITO_APP_CLIENT_ID,
  allowDevTokens: process.env.CMS_ALLOW_DEV_TOKENS === "true",
  adminAllowedOrigins: (process.env.ADMIN_ALLOWED_ORIGINS ?? "http://localhost:5174,http://127.0.0.1:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxMediaBytes: Number(process.env.MAX_MEDIA_BYTES ?? 10 * 1024 * 1024),
  codeBuildProjectName: process.env.CODEBUILD_PROJECT_NAME,
  codeBuildQueuedTimeoutMinutes: Number(process.env.CODEBUILD_QUEUED_TIMEOUT_MINUTES ?? "30")
};
