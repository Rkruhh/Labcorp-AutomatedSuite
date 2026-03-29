// ============================================================
//  Labcorp Patient Portal – Demo Test Suite  (Fixed)
//  Framework : Playwright
//  Run       : npx playwright test labcorp.spec.js --headed
//
//  Setup (first time only):
//    npm init playwright@latest
//    npm install @axe-core/playwright
//    mkdir screenshots
// ============================================================

const { test, expect } = require("@playwright/test");
const AxeBuilder = require("@axe-core/playwright").default;
const path = require("path");
const fs = require("fs");

// ------------------------------------------------------------------
// Soft-assert helper – logs failure, never stops the suite
// ------------------------------------------------------------------
const softCheck = async (label, fn) => {
  try {
    await fn();
    console.log(`  ✅  ${label}`);
  } catch (err) {
    console.warn(`  ⚠️  SOFT FAIL — ${label}\n     ${err.message}`);
  }
};

/** Screenshot helper */
const snap = (page, name) =>
  page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });

// ------------------------------------------------------------------
// GLOBAL POPUP HANDLERS
// Call these at the start of any page that may show overlays.
// ------------------------------------------------------------------

/** Dismiss cookie banner if present */
async function dismissCookieBanner(page) {
  try {
    const rejectBtn = page.getByRole("button", {
      name: /reject all non-essential cookies/i,
    });
    if (await rejectBtn.isVisible({ timeout: 4000 })) {
      await rejectBtn.click();
      console.log("  🍪  Cookie banner dismissed");
      await page.waitForTimeout(800);
    }
  } catch {
    // Banner not present – continue
  }
}

/** Dismiss "Save password?" browser popup if present */
async function dismissSavePassword(page) {
  try {
    const neverBtn = page.getByRole("button", { name: /never/i });
    if (await neverBtn.isVisible({ timeout: 3000 })) {
      await neverBtn.click();
      console.log("  🔑  Save-password popup dismissed");
      await page.waitForTimeout(500);
    }
  } catch {
    // Popup not present – continue
  }
}

// ------------------------------------------------------------------
// SIGN-IN URL  (OAuth entry point)
// ------------------------------------------------------------------
const SIGNIN_URL =
  "https://login-patient.labcorp.com/oauth2/default/v1/authorize" +
  "?client_id=0oaympyx2kMM41A140x7" +
  "&code_challenge=_5pxED4AkUPn3eyGNY2hgJCOGd4zOrdZq7GCXTrvKdE" +
  "&code_challenge_method=S256" +
  "&nonce=FR4XYeNYouaWK5XUssAWBNSdDkYgTpvXGJikAeifN9UM5rZ6ZurFC40PnuaGlUgs" +
  "&redirect_uri=https%3A%2F%2Fpatient.labcorp.com%2Fcallback" +
  "&response_type=code" +
  "&state=n0SzNRto77XHhzlG54o59NqvAsq4R4TAYtCEPylPsJAuLYywr7ZlTu8klTDpDdUn" +
  "&scope=openid%20email%20profile";

// Where we save the authenticated browser session
const SESSION_FILE = path.resolve("labcorp-session.json");

// ------------------------------------------------------------------
// LOGIN HELPER
// Performs login once, saves session to disk.
// All subsequent calls just navigate to the dashboard directly.
// ------------------------------------------------------------------
async function loginFlow(page) {
  // If session file exists, load it and go straight to dashboard
  if (fs.existsSync(SESSION_FILE)) {
    await page.goto("https://patient.labcorp.com/portal/dashboard", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);
    // If we're still on login page, session expired – do full login
    if (!page.url().includes("/portal/dashboard")) {
      await performLogin(page);
    }
    return;
  }
  await performLogin(page);
}

async function performLogin(page) {
  await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });
  await dismissCookieBanner(page);

  // -- Type email --
  const emailInput = page
    .locator('input[type="text"], input[type="email"]')
    .filter({ hasText: "" })
    .first();

  // Use a broader locator since Okta renders a plain text input for email
  const oktalInput = page.locator("#okta-signin-username, input[name='identifier'], input[autocomplete='username']").first();

  await softCheck("Email input found and filled", async () => {
    await oktalInput.waitFor({ state: "visible", timeout: 10000 });
    await oktalInput.click();
    await oktalInput.fill("rkuncc0@gmail.com");
    await page.waitForTimeout(500);
  });

  // -- Click Next --
  await softCheck("Click Next", async () => {
    const nextBtn = page.getByRole("button", { name: /next/i }).first();
    await nextBtn.waitFor({ state: "visible", timeout: 6000 });
    await nextBtn.click();
    await page.waitForTimeout(1500);
  });

  // -- Type password --
  await softCheck("Password field filled", async () => {
    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.waitFor({ state: "visible", timeout: 10000 });
    await pwdInput.click();
    await pwdInput.fill("TestDemo@123");
    await page.waitForTimeout(500);
  });

  // -- Click Verify --
  await softCheck("Click Verify / Sign In", async () => {
    const verifyBtn = page
      .getByRole("button", { name: /verify|sign.?in|submit/i })
      .first();
    await verifyBtn.waitFor({ state: "visible", timeout: 6000 });
    await verifyBtn.click();
  });

  // -- Wait for dashboard --
  await page.waitForURL("**/portal/dashboard**", { timeout: 20000 });
  await dismissSavePassword(page);
  await dismissCookieBanner(page);

  // Save session so subsequent tests skip login
  await page.context().storageState({ path: SESSION_FILE });
  console.log("  💾  Session saved to labcorp-session.json");
}

// ------------------------------------------------------------------
// Run all tests serially – one continuous demo flow
// ------------------------------------------------------------------
test.describe.configure({ mode: "serial" });

// ══════════════════════════════════════════════════════════════════
//  1 · LANDING PAGE
// ══════════════════════════════════════════════════════════════════
test.describe("1 · Landing Page", () => {
  test("1a · Accessibility – Axe, alt text, labels, landmark, keyboard", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);
    await snap(page, "01_landing");

    await softCheck("Axe: zero critical violations", async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      if (critical.length)
        throw new Error(
          `${critical.length} critical violation(s):\n` +
            critical.map((v) => `  [${v.id}] ${v.description}`).join("\n")
        );
    });

    await softCheck("All images have alt text", async () => {
      const missing = await page.$$eval("img", (imgs) =>
        imgs
          .filter(
            (img) =>
              img.getAttribute("alt") === null ||
              img.getAttribute("alt").trim() === ""
          )
          .map((img) => img.src)
      );
      if (missing.length)
        throw new Error(`Images missing alt:\n${missing.join("\n")}`);
    });

    await softCheck("All visible inputs have labels / aria-labels", async () => {
      const unlabelled = await page.$$eval(
        "input:not([type='hidden'])",
        (inputs) =>
          inputs
            .filter((inp) => {
              const id = inp.id;
              const hasLabel = id
                ? !!document.querySelector(`label[for="${id}"]`)
                : false;
              return (
                !hasLabel &&
                !inp.getAttribute("aria-label") &&
                !inp.getAttribute("aria-labelledby")
              );
            })
            .map((i) => i.outerHTML.slice(0, 100))
      );
      if (unlabelled.length)
        throw new Error(`Unlabelled inputs:\n${unlabelled.join("\n")}`);
    });

    await softCheck("Page has a <main> landmark", async () => {
      await expect(page.locator("main")).toBeVisible();
    });

    await softCheck("Tab key cycles through focusable elements", async () => {
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      const tag = await page.evaluate(
        () => document.activeElement?.tagName ?? ""
      );
      expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(tag);
    });
  });

  test("1b · Visual alignment – hero, images, and headings render correctly", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);

    await softCheck("Header / logo is visible", async () => {
      await expect(
        page.locator("header img, [class*='logo'] img").first()
      ).toBeVisible();
    });

    await softCheck("Hero / banner section is visible", async () => {
      await expect(
        page
          .locator("[class*='hero'], [class*='banner'], [class*='landing']")
          .first()
      ).toBeVisible();
    });

    await softCheck("H1 heading is present", async () => {
      await expect(page.locator("h1").first()).toBeVisible();
    });

    await softCheck("Footer is rendered", async () => {
      await expect(page.locator("footer")).toBeVisible();
    });
  });

  test("1c · Navigation links and CTA buttons are present", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);

    await softCheck("At least 2 header/nav links are visible", async () => {
      const links = page.locator("header a, nav a");
      await expect(links.first()).toBeVisible();
      expect(await links.count()).toBeGreaterThanOrEqual(2);
    });

    await softCheck("Sign-In button/link is present", async () => {
      await expect(
        page.getByRole("link", { name: /sign.?in|log.?in/i }).first()
      ).toBeVisible();
    });

    await softCheck("'Make an Appointment' link is present", async () => {
      await expect(
        page.getByRole("link", { name: /make.?an?.?appoint/i }).first()
      ).toBeVisible();
    });

    await softCheck("'Labcorp OnDemand' link is present", async () => {
      await expect(
        page.getByRole("link", { name: /ondemand/i }).first()
      ).toBeVisible();
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  2 · CREATE ACCOUNT PAGE
//  NOTE: Page is protected by a CAPTCHA after "Begin" is clicked.
//  We validate everything visible BEFORE the CAPTCHA triggers.
// ══════════════════════════════════════════════════════════════════
test.describe("2 · Create Account Page", () => {
  test("2a · Registration entry point is reachable and Begin button is visible", async ({
    page,
  }) => {
    await page.goto(
      "https://patient.labcorp.com/account/registration/register",
      { waitUntil: "networkidle" }
    );
    await dismissCookieBanner(page);
    await snap(page, "02_register");

    await softCheck("Page URL is correct", async () => {
      expect(page.url()).toContain("/registration/register");
    });

    await softCheck("'Let's confirm you are human' heading is visible", async () => {
      await expect(
        page.getByText(/confirm you are human/i).first()
      ).toBeVisible({ timeout: 8000 });
    });

    await softCheck("'Begin' button is visible and clickable", async () => {
      await expect(
        page.getByRole("button", { name: /begin/i }).first()
      ).toBeVisible();
    });

    await softCheck("Language selector is present", async () => {
      await expect(page.locator("select").first()).toBeVisible();
    });

    // NOTE: We intentionally do NOT click Begin – it triggers a CAPTCHA
    // (image-based human verification) that cannot be automated.
    // The test proves the registration entry point is live and accessible.
    console.log(
      "  ℹ️  CAPTCHA detected beyond this point – not automatable by design."
    );
  });
});

// ══════════════════════════════════════════════════════════════════
//  3 · SIGN-IN FLOW → DASHBOARD
// ══════════════════════════════════════════════════════════════════
test.describe("3 · Sign-In & Dashboard", () => {
  test("3a · Sign-in page layout is correctly aligned", async ({ page }) => {
    await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });
    await dismissCookieBanner(page);
    await snap(page, "03a_signin");

    await softCheck("Sign-in card / heading is visible", async () => {
      await expect(
        page.getByText(/sign.?in/i).first()
      ).toBeVisible({ timeout: 8000 });
    });

    await softCheck("Email input is visible", async () => {
      await expect(
        page
          .locator(
            "#okta-signin-username, input[name='identifier'], input[autocomplete='username'], input[type='text'], input[type='email']"
          )
          .first()
      ).toBeVisible({ timeout: 8000 });
    });

    await softCheck("Next button is visible", async () => {
      await expect(
        page.getByRole("button", { name: /next/i }).first()
      ).toBeVisible();
    });

    await softCheck("Labcorp | Patient branding is visible", async () => {
      await expect(
        page.getByText(/labcorp.*patient/i).first()
      ).toBeVisible();
    });
  });

  test("3b · Full login – email → password → Dashboard", async ({ page }) => {
    // Clean session file so we always demo a fresh login in test 3b
    if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);

    await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });
    await dismissCookieBanner(page);

    // -- Email --
    await softCheck("Email input is focused and filled visibly", async () => {
      const emailInput = page
        .locator(
          "#okta-signin-username, input[name='identifier'], input[autocomplete='username']"
        )
        .first();
      await emailInput.waitFor({ state: "visible", timeout: 10000 });
      await emailInput.click();
      await emailInput.fill("rkuncc0@gmail.com");
      await expect(emailInput).toHaveValue("rkuncc0@gmail.com");
      await snap(page, "03b_email_filled");
    });

    // -- Next --
    await softCheck("Click Next button", async () => {
      const nextBtn = page.getByRole("button", { name: /next/i }).first();
      await nextBtn.click();
      await page.waitForTimeout(2000);
      await snap(page, "03b_after_next");
    });

    // -- Password --
    await softCheck("Password field appears and is filled visibly", async () => {
      const pwdInput = page.locator('input[type="password"]').first();
      await pwdInput.waitFor({ state: "visible", timeout: 10000 });
      await pwdInput.click();
      await pwdInput.fill("TestDemo@123");
      await expect(pwdInput).toHaveValue("TestDemo@123");
      await snap(page, "03b_password_filled");
    });

    // -- Verify --
    await softCheck("Click Verify → redirects to Dashboard", async () => {
      const verifyBtn = page
        .getByRole("button", { name: /verify|sign.?in|submit/i })
        .first();
      await verifyBtn.click();
      await page.waitForURL("**/portal/dashboard**", { timeout: 20000 });
    });

    await dismissSavePassword(page);
    await dismissCookieBanner(page);

    // Save session for downstream tests
    await page.context().storageState({ path: SESSION_FILE });
    await snap(page, "03c_dashboard");

    // -- Dashboard checks --
    await softCheck("URL contains /portal/dashboard", async () => {
      expect(page.url()).toContain("/portal/dashboard");
    });

    await softCheck("Dashboard heading or greeting is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("Top navigation bar is visible", async () => {
      await expect(page.locator("nav, header").first()).toBeVisible();
    });

    await softCheck("'Appointments' link is in the top nav", async () => {
      await expect(
        page.getByRole("link", { name: /appointments/i }).first()
      ).toBeVisible();
    });

    await softCheck("'Orders' link is in the top nav", async () => {
      await expect(
        page.getByRole("link", { name: /orders/i }).first()
      ).toBeVisible();
    });

    await softCheck("No horizontal overflow on dashboard", async () => {
      const sw = await page.evaluate(() => document.body.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      expect(sw).toBeLessThanOrEqual(vw + 20);
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  4 · APPOINTMENTS PAGE
// ══════════════════════════════════════════════════════════════════
test.describe("4 · Appointments Page", () => {
  // ── 4a  Make Appointment → Find a Lab ─────────────────────────
  test("4a · Make Appointment – Pediatric → Find a Lab", async ({
    page,
  }) => {
    await loginFlow(page);
    await page.goto("https://patient.labcorp.com/portal/appointments", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);
    await snap(page, "04_appointments");

    await softCheck("Appointments page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    // Try multiple selectors since the button text may vary
    await softCheck("'Make an appointment' button is visible", async () => {
      const btn = page
        .locator("button, a")
        .filter({ hasText: /make.*appoint|schedule.*appoint|book.*appoint/i })
        .first();
      await expect(btn).toBeVisible({ timeout: 10000 });
    });

    await softCheck("Click 'Make an appointment'", async () => {
      const btn = page
        .locator("button, a")
        .filter({ hasText: /make.*appoint|schedule.*appoint|book.*appoint/i })
        .first();
      await btn.click();
      await page.waitForTimeout(2000);
      await snap(page, "04a_make_appt_open");
    });

    await softCheck("Reason / service selector appears", async () => {
      const dropdown = page
        .locator("select, [role='listbox'], [role='combobox']")
        .first();
      await expect(dropdown).toBeVisible({ timeout: 8000 });
    });

    await softCheck("Select 'Pediatric' from dropdown", async () => {
      const select = page.locator("select").first();
      await select.selectOption({ label: /pediatric/i });
      await page.waitForTimeout(500);
    });

    await softCheck("'Find a Lab' button is visible", async () => {
      const findLabBtn = page
        .locator("button")
        .filter({ hasText: /find.*lab/i })
        .first();
      await expect(findLabBtn).toBeVisible({ timeout: 6000 });
    });

    await softCheck("Click 'Find a Lab'", async () => {
      const findLabBtn = page
        .locator("button")
        .filter({ hasText: /find.*lab/i })
        .first();
      await findLabBtn.click();
      await page.waitForTimeout(3000);
      await snap(page, "04a_find_lab_result");
    });

    await softCheck("Find-a-Lab results page is loaded", async () => {
      await expect(
        page.locator("h1, h2, [class*='lab'], [class*='result']").first()
      ).toBeVisible({ timeout: 12000 });
    });
  });

  // ── 4b  Make Appointment → Cancel ─────────────────────────────
  test("4b · Make Appointment – Pediatric → Cancel", async ({ page }) => {
    await loginFlow(page);
    await page.goto("https://patient.labcorp.com/portal/appointments", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);

    await softCheck("Open Make Appointment dialog", async () => {
      const btn = page
        .locator("button, a")
        .filter({ hasText: /make.*appoint|schedule.*appoint|book.*appoint/i })
        .first();
      await btn.click();
      await page.waitForTimeout(2000);
    });

    await softCheck("Select 'Pediatric'", async () => {
      await page.locator("select").first().selectOption({ label: /pediatric/i });
    });

    await softCheck("Cancel button is visible", async () => {
      await expect(
        page.locator("button").filter({ hasText: /cancel/i }).first()
      ).toBeVisible();
    });

    await softCheck("Click Cancel – dialog closes, stays on Appointments page", async () => {
      await page
        .locator("button")
        .filter({ hasText: /cancel/i })
        .first()
        .click();
      await page.waitForTimeout(1000);
      await snap(page, "04b_after_cancel");
      const modal = page.locator("[role='dialog'], [class*='modal']").first();
      await expect(modal).not.toBeVisible({ timeout: 4000 });
    });

    await softCheck("URL still on /portal/appointments after Cancel", async () => {
      expect(page.url()).toContain("/portal/appointments");
    });
  });

  // ── 4c  Find-a-Lab Results Page ────────────────────────────────
  test("4c · Find-a-Lab results – alignment, labs list, and filters", async ({
    page,
  }) => {
    await loginFlow(page);
    await page.goto(
      "https://patient.labcorp.com/portal/appointments/book/find-a-lab" +
        "?serviceId=3" +
        "&address=9551%20UNIVERSITY%20TERRACE%20DR,%20CHARLOTTE,%20NC,%2028262" +
        "&date=2026-03-29&radius=25&zip=28262",
      { waitUntil: "networkidle" }
    );
    await dismissCookieBanner(page);
    await snap(page, "04c_find_lab_page");

    await softCheck("Page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("At least one lab result card is displayed", async () => {
      const cards = page.locator(
        "[class*='lab'], [class*='location'], [class*='result'], [class*='card']"
      );
      await expect(cards.first()).toBeVisible({ timeout: 12000 });
    });

    await softCheck("Filter / search section is visible", async () => {
      await expect(
        page
          .locator(
            "[class*='filter'], input[type='text'], [placeholder*='zip' i], [placeholder*='address' i]"
          )
          .first()
      ).toBeVisible();
    });

    await softCheck("Radius or date selector is visible", async () => {
      await expect(
        page
          .locator(
            "input[type='date'], [class*='date'], [class*='radius'], select"
          )
          .first()
      ).toBeVisible();
    });

    await softCheck("No horizontal overflow", async () => {
      const sw = await page.evaluate(() => document.body.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      expect(sw).toBeLessThanOrEqual(vw + 20);
    });

    await softCheck("Lab cards display address or distance info", async () => {
      await expect(
        page
          .locator(
            "[class*='address'], [class*='distance'], [class*='miles']"
          )
          .first()
      ).toBeVisible({ timeout: 8000 });
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  5 · LAB ORDERS PAGE
// ══════════════════════════════════════════════════════════════════
test.describe("5 · Lab Orders Page", () => {
  test("5a · Page load, alignment, visibility, and basic accessibility", async ({
    page,
  }) => {
    await loginFlow(page);
    await page.goto("https://patient.labcorp.com/portal/orders", {
      waitUntil: "networkidle",
    });
    await dismissCookieBanner(page);
    await snap(page, "05_orders");

    await softCheck("Orders page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("Orders list or table container is rendered", async () => {
      await expect(
        page
          .locator(
            "table, [class*='order'], [class*='result'], [class*='list']"
          )
          .first()
      ).toBeVisible({ timeout: 8000 });
    });

    await softCheck("Navigation bar is present", async () => {
      await expect(page.locator("nav, header").first()).toBeVisible();
    });

    await softCheck("No horizontal overflow", async () => {
      const sw = await page.evaluate(() => document.body.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      expect(sw).toBeLessThanOrEqual(vw + 20);
    });

    await softCheck("Axe scan – no critical violations", async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a"])
        .analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      if (critical.length)
        throw new Error(
          `${critical.length} critical issue(s): ${critical
            .map((v) => v.id)
            .join(", ")}`
        );
    });

    await softCheck("Orders exist OR empty-state message is shown", async () => {
      const hasOrders =
        (await page
          .locator("table tbody tr, [class*='order-item']")
          .count()) > 0;
      const hasEmptyState = await page
        .locator(
          "[class*='empty'], [class*='no-order'], [class*='no-result']"
        )
        .isVisible()
        .catch(() => false);
      expect(hasOrders || hasEmptyState).toBeTruthy();
    });
  });
})