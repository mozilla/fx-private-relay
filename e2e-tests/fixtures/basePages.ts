import { LandingPage } from "../pages/landingPage";
import { AuthPage } from "../pages/authPage";
import { test as baseTest } from "@playwright/test";
import { DashboardPage } from "../pages/dashboardPage";
import { SubscriptionPaymentPage } from "../pages/subscriptionPaymentPage";
import { MozillaMonitorPage } from "../pages/mozillaMonitorPage";

const test = baseTest.extend<{
  landingPage: LandingPage;
  authPage: AuthPage;
  dashboardPage: DashboardPage;
  subscriptionPage: SubscriptionPaymentPage;
  mozillaMonitorPage: MozillaMonitorPage;
}>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  landingPage: async ({ page }, use) => {
    await use(new LandingPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  subscriptionPage: async ({ page }, use) => {
    await use(new SubscriptionPaymentPage(page));
  },
  mozillaMonitorPage: async ({ page }, use) => {
    await use(new MozillaMonitorPage(page));
  },
});

export default test;
export const expect = test.expect;
