import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    host: '0.0.0.0', // 這裡設定允許外部 IP 訪問
    port: 5173,      // 指定端口 (預設就是 5173)
    allowedHosts: true, // 允許所有主機訪問
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      }
    }
  }
});