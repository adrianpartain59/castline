import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Relative base so the build serves from GitHub Pages under /castline/.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: { environment: "node" },
});
