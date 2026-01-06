import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// eslint-disable-next-line no-restricted-syntax
export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate Monaco Editor into its own chunk
          monaco: ["monaco-editor"],
          // Separate TypeScript into its own chunk
          typescript: ["typescript"],
        },
      },
    },
  },
});
