// playwright.config.js
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testMatch: ["**/labcorp.spec.js"],

  fullyParallel: false,
  workers: 1,

  timeout: 60_000,
  expect: { timeout: 12_000 },

  retries: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    headless: false,
    slowMo: 500,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "Chrome – Desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--disable-features=PasswordManagerOnboarding,AutofillPasswordManagerDesktop",
            "--password-store=basic",
          ],
        },
      },
    },
  ],
});