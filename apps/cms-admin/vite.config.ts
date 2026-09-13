import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/media": {
        target: process.env.VITE_CMS_API_URL || "http://localhost:8787",
        changeOrigin: true
      }
    }
  }
});
