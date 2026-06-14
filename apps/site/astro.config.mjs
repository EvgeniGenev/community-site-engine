import { defineConfig } from "astro/config";
import { resolve } from "node:path";

export default defineConfig({
  output: "static",
  site: process.env.SITE_URL ?? "https://example.com",
  trailingSlash: "always",
  vite: {
    plugins: [
      {
        name: 'watch-content',
        configureServer(server) {
          server.watcher.add(resolve('../../site-assets/content'));
          server.watcher.on('all', (event, path) => {
            if (path.includes('site-assets') && path.includes('content')) {
              server.ws.send({ type: 'full-reload', path: '*' });
            }
          });
        }
      }
    ]
  }
});
