import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local dev proxies /api to a simple Python server or Vercel dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        // Use 127.0.0.1 — on macOS "localhost" often resolves to ::1, but dev_server binds IPv4 only.
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
      },
    },
  },
});
