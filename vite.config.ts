import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@data": fileURLToPath(new URL("./data", import.meta.url)),
      "@ui": fileURLToPath(new URL("./packages/ui", import.meta.url)),
    },
  },
  server: {
    port: 7901,
    open: "/index.html",
  },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        sheet: "sheet.html",
        builder: "builder.html",
      },
    },
  },
});
