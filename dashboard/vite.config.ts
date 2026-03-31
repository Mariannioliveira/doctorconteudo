import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { squadWatcherPlugin } from "./src/plugin/squadWatcher";

export default defineConfig({
  plugins: [react(), squadWatcherPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Proxy /api/* to the FastAPI backend in development
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        // SSE needs to stream — disable request buffering
        configure: (proxy) => {
          proxy.on("proxyReq", (_proxyReq, req) => {
            if (req.headers.accept?.includes("text/event-stream")) {
              _proxyReq.setHeader("Cache-Control", "no-cache");
            }
          });
        },
      },
    },
  },
});
