import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const backendHost = process.env.HOST || "127.0.0.1";
const backendPort = process.env.PORT || "4200";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: `http://${backendHost}:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "happy-dom",
  },
  fmt: {},
  lint: {
    options: { typeAware: false, typeCheck: false },
  },
});
