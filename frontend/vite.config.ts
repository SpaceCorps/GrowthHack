import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4200",
        changeOrigin: true,
      },
    },
  },
  fmt: {},
  lint: {
    options: { typeAware: false, typeCheck: false },
  },
});
