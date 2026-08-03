import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite konfigurasi — dev server di 8090, proxy ke backend 5300
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8090,
    proxy: {
      "/api": {
        target: "http://localhost:5300",
        changeOrigin: true,
      },
    },
  },
});