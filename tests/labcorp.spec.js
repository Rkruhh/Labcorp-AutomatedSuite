// ============================================================
//  Labcorp Patient Portal – Demo Test Suite
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

// ------------------------------------------------------------------
// Soft-assert helper
// Logs failures without stopping the suite – ideal for demo flow.
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
// Run all tests serially (one continuous flow, no parallelism).
// ------------------------------------------------------------------
test.describe.configure({ mode: "serial" });

// ══════════════════════════════════════════════════════════════════
//  SHARED LOGIN HELPER
//  Used by tests that need an authenticated session.
// ══════════════════════════════════════════════════════════════════
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

async function loginFlow(page) {
  if (page.url().includes("/portal/dashboard")) return;

  await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });

  if (page.url().includes("/portal/dashboard")) return;

  try {
    const emailInput = page
      .locator('input[type="email"], input[name*="email"], input[id*="email"]')
      .first();
    await emailInput.waitFor({ timeout: 8000 });
    await emailInput.fill("rkuncc0@gmail.com");

    await page.getByRole("button", { name: /next/i }).first().click();

    const pwdInput = page.locator('input[type="password"]').first();
    await pwdInput.waitFor({ timeout: 8000 });
    await pwdInput.fill("TestDemo@123");

    await page
      .getByRole("button", { name: /verify|sign.?in|log.?in|submit/i })
      .first()
      .click();

    await page.waitForURL("**/portal/dashboard**", { timeout: 15000 });
  } catch (err) {
    console.warn("⚠️  loginFlow: could not complete login –", err.message);
  }
}

// ══════════════════════════════════════════════════════════════════
//  1 · LANDING PAGE
// ══════════════════════════════════════════════════════════════════
test.describe("1 · Landing Page", () => {
  // ── 1a  Accessibility ──────────────────────────────────────────
  test("1a · Accessibility – Axe, alt text, labels, landmark, keyboard", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });
    await snap(page, "01_landing");

    await softCheck("Axe: zero critical violations", async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical"
      );
      if (critical.length) {
        throw new Error(
          `${critical.length} critical violation(s):\n` +
            critical.map((v) => `  [${v.id}] ${v.description}`).join("\n")
        );
      }
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

  // ── 1b  Visual Alignment ───────────────────────────────────────
  test("1b · Visual alignment – hero, images, and headings render correctly", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });

    await softCheck("Header / logo image is visible", async () => {
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

    await softCheck("Page body height is reasonable (> 400 px)", async () => {
      const h = await page.evaluate(() => document.body.scrollHeight);
      expect(h).toBeGreaterThan(400);
    });

    await softCheck("Footer is rendered", async () => {
      await expect(page.locator("footer")).toBeVisible();
    });
  });

  // ── 1c  Navigation / CTA Links ─────────────────────────────────
  test("1c · Navigation links and CTA buttons are present", async ({
    page,
  }) => {
    await page.goto("https://patient.labcorp.com/landing", {
      waitUntil: "networkidle",
    });

    await softCheck("At least 2 header/nav links are visible", async () => {
      const links = page.locator("header a, nav a");
      await expect(links.first()).toBeVisible();
      expect(await links.count()).toBeGreaterThanOrEqual(2);
    });

    await softCheck("Sign-In link is present", async () => {
      await expect(
        page.getByRole("link", { name: /sign.?in|log.?in/i }).first()
      ).toBeVisible();
    });

    await softCheck("Create Account / Register link is present", async () => {
      await expect(
        page
          .getByRole("link", {
            name: /create.?account|register|sign.?up/i,
          })
          .first()
      ).toBeVisible();
    });

    await softCheck("Clicking Sign-In link navigates away from landing", async () => {
      const [newPage] = await Promise.all([
        page.context().waitForEvent("page").catch(() => null),
        page.getByRole("link", { name: /sign.?in|log.?in/i }).first().click(),
      ]);
      const targetUrl = newPage ? newPage.url() : page.url();
      expect(targetUrl).not.toContain("/landing");
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  2 · CREATE ACCOUNT PAGE
// ══════════════════════════════════════════════════════════════════
test.describe("2 · Create Account Page", () => {
  test("2a · All registration fields and labels are visible and aligned", async ({
    page,
  }) => {
    await page.goto(
      "https://patient.labcorp.com/account/registration/register",
      { waitUntil: "networkidle" }
    );
    await snap(page, "02_register");

    await softCheck("Page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    const expectedLabels = [
      /first.?name/i,
      /last.?name/i,
      /date.?of.?birth|dob/i,
      /sex|gender/i,
      /email/i,
      /password/i,
    ];

    for (const pattern of expectedLabels) {
      await softCheck(`Label visible: ${pattern}`, async () => {
        const label = page
          .locator("label, [class*='label']")
          .filter({ hasText: pattern })
          .first();
        await expect(label).toBeVisible();
      });
    }

    await softCheck("Submit / Continue button is visible", async () => {
      await expect(
        page
          .getByRole("button", {
            name: /submit|continue|next|register|create/i,
          })
          .first()
      ).toBeVisible();
    });

    await softCheck("No input element is horizontally clipped", async () => {
      const inputs = await page.$$("input:visible, select:visible");
      for (const inp of inputs) {
        const box = await inp.boundingBox();
        if (box) expect(box.x).toBeGreaterThanOrEqual(0);
      }
    });

    await softCheck("Password field is of type 'password' (masked)", async () => {
      const pwd = page.locator('input[type="password"]').first();
      await expect(pwd).toBeVisible();
    });
  });
});

// ══════════════════════════════════════════════════════════════════
//  3 · SIGN-IN FLOW → DASHBOARD
// ══════════════════════════════════════════════════════════════════
test.describe("3 · Sign-In & Dashboard", () => {
  test("3a · Sign-in page layout is correctly aligned", async ({ page }) => {
    await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });
    await snap(page, "03a_signin");

    await softCheck("Sign-in heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("Email input is visible", async () => {
      await expect(
        page
          .locator(
            'input[type="email"], input[name*="email"], input[id*="email"]'
          )
          .first()
      ).toBeVisible();
    });

    await softCheck("Next button is visible", async () => {
      await expect(
        page.getByRole("button", { name: /next/i }).first()
      ).toBeVisible();
    });

    await softCheck("Labcorp branding / logo is visible", async () => {
      await expect(
        page
          .locator(
            "img[alt*='Labcorp' i], img[src*='labcorp' i], [class*='logo']"
          )
          .first()
      ).toBeVisible();
    });
  });

  test("3b · Full login flow lands on the Dashboard", async ({ page }) => {
    await page.goto(SIGNIN_URL, { waitUntil: "networkidle" });

    await softCheck("Fill email and click Next", async () => {
      const emailInput = page
        .locator(
          'input[type="email"], input[name*="email"], input[id*="email"]'
        )
        .first();
      await emailInput.fill("rkuncc0@gmail.com");
      await page.getByRole("button", { name: /next/i }).first().click();
      await page.waitForTimeout(2000);
      await snap(page, "03b_after_email");
    });

    await softCheck("Password field appears and is filled", async () => {
      const pwd = page.locator('input[type="password"]').first();
      await expect(pwd).toBeVisible({ timeout: 8000 });
      await pwd.fill("TestDemo@123");
    });

    await softCheck("Click Verify → redirect to Dashboard", async () => {
      await page
        .getByRole("button", { name: /verify|sign.?in|log.?in|submit/i })
        .first()
        .click();
      await page.waitForURL("**/portal/dashboard**", { timeout: 15000 });
      await snap(page, "03c_dashboard");
    });

    await softCheck("URL contains /portal/dashboard", async () => {
      expect(page.url()).toContain("/portal/dashboard");
    });

    await softCheck("Dashboard heading or user greeting is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("Top navigation bar is visible", async () => {
      await expect(page.locator("nav, header").first()).toBeVisible();
    });

    await softCheck("'Appointments' link appears in the top nav", async () => {
      await expect(
        page.getByRole("link", { name: /appointments/i }).first()
      ).toBeVisible();
    });

    await softCheck("'Orders' or 'Lab Orders' link appears in the top nav", async () => {
      await expect(
        page.getByRole("link", { name: /orders/i }).first()
      ).toBeVisible();
    });

    await softCheck("Dashboard has no horizontal overflow", async () => {
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
  test("4a · Make Appointment – Pediatric → Find a Lab flow", async ({
    page,
  }) => {
    await loginFlow(page);
    await page.goto("https://patient.labcorp.com/portal/appointments", {
      waitUntil: "networkidle",
    });
    await snap(page, "04_appointments");

    await softCheck("Appointments page heading visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("'Make an appointment' button is visible", async () => {
      await expect(
        page.getByRole("button", { name: /make.?an?.?appoint/i }).first()
      ).toBeVisible();
    });

    await softCheck("Click 'Make an appointment'", async () => {
      await page
        .getByRole("button", { name: /make.?an?.?appoint/i })
        .first()
        .click();
      await page.waitForTimeout(1500);
      await snap(page, "04a_make_appt_open");
    });

    await softCheck("Reason / service dropdown is visible", async () => {
      await expect(page.locator("select").first()).toBeVisible({
        timeout: 6000,
      });
    });

    await softCheck("Select 'Pediatric' from the dropdown", async () => {
      await page.locator("select").first().selectOption({ label: /pediatric/i });
    });

    await softCheck("'Find a Lab' button is visible after selecting reason", async () => {
      await expect(
        page.getByRole("button", { name: /find.?a.?lab/i }).first()
      ).toBeVisible();
    });

    await softCheck("Click 'Find a Lab'", async () => {
      await page.getByRole("button", { name: /find.?a.?lab/i }).first().click();
      await page.waitForTimeout(2500);
      await snap(page, "04a_find_lab_result");
    });

    await softCheck("Find-a-Lab results page is loaded", async () => {
      await expect(
        page
          .locator("h1, h2, [class*='lab'], [class*='result']")
          .first()
      ).toBeVisible({ timeout: 10000 });
    });
  });

  // ── 4b  Make Appointment → Cancel ─────────────────────────────
  test("4b · Make Appointment – Pediatric → Cancel button", async ({
    page,
  }) => {
    await loginFlow(page);
    await page.goto("https://patient.labcorp.com/portal/appointments", {
      waitUntil: "networkidle",
    });

    await softCheck("Open the Make Appointment dialog", async () => {
      await page
        .getByRole("button", { name: /make.?an?.?appoint/i })
        .first()
        .click();
      await page.waitForTimeout(1500);
    });

    await softCheck("Select 'Pediatric'", async () => {
      await page.locator("select").first().selectOption({ label: /pediatric/i });
    });

    await softCheck("Cancel button is visible", async () => {
      await expect(
        page.getByRole("button", { name: /cancel/i }).first()
      ).toBeVisible();
    });

    await softCheck("Click Cancel – dialog/modal closes", async () => {
      await page.getByRole("button", { name: /cancel/i }).first().click();
      await page.waitForTimeout(1000);
      await snap(page, "04b_after_cancel");
      const modal = page
        .locator("[role='dialog'], [class*='modal'], [class*='overlay']")
        .first();
      await expect(modal).not.toBeVisible({ timeout: 4000 });
    });

    await softCheck("User remains on the Appointments page after Cancel", async () => {
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
    await snap(page, "04c_find_lab_page");

    await softCheck("Page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("At least one lab result card is displayed", async () => {
      const cards = page.locator(
        "[class*='lab'], [class*='location'], [class*='result'], [class*='card']"
      );
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
    });

    await softCheck("Filter / search section is visible", async () => {
      const filter = page
        .locator(
          "[class*='filter'], input[type='text'], [placeholder*='zip' i], [placeholder*='address' i]"
        )
        .first();
      await expect(filter).toBeVisible();
    });

    await softCheck("Radius / date selector is visible", async () => {
      await expect(
        page
          .locator("input[type='date'], [class*='date'], [class*='radius'], select")
          .first()
      ).toBeVisible();
    });

    await softCheck("No horizontal overflow (content fits viewport)", async () => {
      const sw = await page.evaluate(() => document.body.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      expect(sw).toBeLessThanOrEqual(vw + 20);
    });

    await softCheck("Lab cards display address or distance information", async () => {
      const addressText = page
        .locator("[class*='address'], [class*='distance'], [class*='miles']")
        .first();
      await expect(addressText).toBeVisible({ timeout: 8000 });
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
    await snap(page, "05_orders");

    await softCheck("Orders page heading is visible", async () => {
      await expect(page.locator("h1, h2").first()).toBeVisible();
    });

    await softCheck("Orders list or table container is rendered", async () => {
      await expect(
        page
          .locator("table, [class*='order'], [class*='result'], [class*='list']")
          .first()
      ).toBeVisible({ timeout: 8000 });
    });

    await softCheck("Navigation bar is present (authenticated state preserved)", async () => {
      await expect(page.locator("nav, header").first()).toBeVisible();
    });

    await softCheck("Page has no horizontal overflow", async () => {
      const sw = await page.evaluate(() => document.body.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      expect(sw).toBeLessThanOrEqual(vw + 20);
    });

    await softCheck("Axe scan – no critical violations on Orders page", async () => {
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a"])
        .analyze();
      const critical = results.violations.filter(
        (v) => v.impact === "critical"
      );
      if (critical.length)
        throw new Error(
          `${critical.length} critical issue(s): ${critical
            .map((v) => v.id)
            .join(", ")}`
        );
    });

    await softCheck("Empty-state message is shown when no orders exist", async () => {
      const hasOrders = (await page.locator("table tbody tr, [class*='order-item']").count()) > 0;
      const hasEmptyState = await page
        .locator("[class*='empty'], [class*='no-order'], [class*='no-result']")
        .isVisible()
        .catch(() => false);
      expect(hasOrders || hasEmptyState).toBeTruthy();
    });
  });
});
