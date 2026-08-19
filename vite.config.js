import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendUrl = env.CHATBOT_BACKEND_URL || "http://127.0.0.1:8765";
  const apiToken = env.IELTS_API_TOKEN;

  return {
    plugins: [react()],
    server: {
      host: "0.0.0.0",
      port: 8000,
      allowedHosts: [".trycloudflare.com"],
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : undefined,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
