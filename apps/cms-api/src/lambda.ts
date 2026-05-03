import { handle, defaultIsContentTypeBinary } from "hono/aws-lambda";
import { app } from "./app.js";

export const handler = handle(app, {
  isContentTypeBinary: (contentType) =>
    defaultIsContentTypeBinary(contentType) ||
    contentType === "application/zip" ||
    contentType === "application/octet-stream"
});
