// Локально тесты идут в установленном Microsoft Edge, в GitHub Actions — в Chromium.
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.js/,
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.CI ? undefined : "msedge",
    locale: "ru-RU",
    viewport: { width: 1300, height: 860 },
    acceptDownloads: true
  },
  webServer: {
    command: "node serve.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI
  }
});
