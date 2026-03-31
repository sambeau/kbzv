import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

// https://v2.tauri.app/start/frontend/vite/
const host = process.env.TAURI_DEV_HOST;

/**
 * Dev-only Vite plugin that exposes filesystem read endpoints so the
 * frontend can load Kanbanzai projects when running in a plain browser
 * (i.e. without the Tauri runtime).
 *
 * Endpoints:
 *   GET /__dev/fs/read?path=<abs-path>   → file contents as text
 *   GET /__dev/fs/dir?path=<abs-path>    → JSON array of {name, is_dir}
 *   GET /__dev/fs/exists?path=<abs-path> → JSON boolean
 *
 * These are ONLY available via the Vite dev server. They are never
 * included in a production build.
 */
function devFsPlugin(): Plugin {
  return {
    name: "kbzv-dev-fs",
    apply: "serve", // dev server only — never runs during build
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith("/__dev/fs/")) return next();

        const url = new URL(req.url, "http://localhost");
        const filePath = url.searchParams.get("path");

        if (!filePath) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Missing ?path= parameter" }));
          return;
        }

        const route = url.pathname;

        try {
          if (route === "/__dev/fs/read") {
            const content = fs.readFileSync(filePath, "utf-8");
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.end(content);
          } else if (route === "/__dev/fs/dir") {
            const entries = fs.readdirSync(filePath, { withFileTypes: true });
            const result = entries.map((e) => ({
              name: e.name,
              is_dir: e.isDirectory(),
            }));
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } else if (route === "/__dev/fs/exists") {
            const exists = fs.existsSync(filePath);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(exists));
          } else {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Unknown dev-fs route" }));
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const isNotFound =
            err instanceof Error &&
            "code" in err &&
            (err as NodeJS.ErrnoException).code === "ENOENT";
          res.statusCode = isNotFound ? 404 : 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: msg }));
        }
      });
    },
  };
}

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss(), devFsPlugin()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Vite options tailored for Tauri development
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  test: {
    globals: true,
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "**/.worktrees/**"],
  },
}));
