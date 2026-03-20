/**
 * Debug/diagnostic test for the premium account on stage.
 * Run with: E2E_TEST_ENV=stage npx playwright test --project=full-chromium --grep "debug premium"
 * Not included in relay-only-* CI test suite (see playwright.config.ts RELAY_ONLY_TESTS).
 */

import test from "../fixtures/basePages";

test.skip(
  true,
  "Diagnostic test — run manually when debugging premium account issues",
);

// Checks whether the premium account can create masks and what API responses look like.
test("debug premium mask creation", async ({ landingPage, authPage, page }) => {
  await landingPage.open();
  await landingPage.goToSignIn();
  await authPage.login(process.env.E2E_TEST_ACCOUNT_PREMIUM as string);

  await page.waitForURL(/\/accounts\/profile\//, { timeout: 30000 });

  const getResp = await page.request.get("/api/v1/relayaddresses/");
  const masks = await getResp.json();
  console.log(
    "Current relay masks:",
    masks.length,
    "status:",
    getResp.status(),
  );

  // page.request.post won't send Referer — expect 403 CSRF failure
  const cookies = await page.context().cookies();
  const csrfToken = cookies.find((c) => c.name === "csrftoken")?.value ?? "";
  const postResp = await page.request.post("/api/v1/relayaddresses/", {
    data: {},
    headers: { "X-CSRFToken": csrfToken, "Content-Type": "application/json" },
  });
  console.log(
    "POST via page.request status:",
    postResp.status(),
    "body:",
    await postResp.text(),
  );

  // page.evaluate fetch sends Origin — should reach the API logic
  const evalResult = await page.evaluate(async () => {
    const token = document.cookie.match(/csrftoken=([^;]+)/)?.[1] ?? "";
    const resp = await fetch("/api/v1/relayaddresses/", {
      method: "POST",
      headers: { "X-CSRFToken": token, "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({}),
    });
    const body = await resp.text();
    return { status: resp.status, body, csrfFound: !!token };
  });
  console.log(
    "POST via page.evaluate:",
    "status:",
    evalResult.status,
    "csrfFound:",
    evalResult.csrfFound,
    "body:",
    evalResult.body.slice(0, 200),
  );
});
