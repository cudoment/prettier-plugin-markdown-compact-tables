import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.js"],
    exclude: ["__tests__/helpers/**", "__tests__/fixtures/**"],
  },
})
