import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { BundleBanner } from "./BundleBanner";
import { type RuntimeData } from "../../hooks/api/types";

jest.mock(
  "./BundleBanner.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

jest.mock("../Localized.tsx", () => {
  const { mockLocalizedModule } = jest.requireActual(
    "../../../__mocks__/components/Localized",
  );
  return mockLocalizedModule;
});

const getBundlePriceMock = jest.fn();
const getBundleSubscribeLinkMock = jest.fn();
const isBundleAvailableInCountryMock = jest.fn();

jest.mock("../../functions/getPlan", () => ({
  __esModule: true,
  getBundlePrice: (...args: unknown[]) => getBundlePriceMock(...args),
  getBundleSubscribeLink: (...args: unknown[]) =>
    getBundleSubscribeLinkMock(...args),
  isBundleAvailableInCountry: (...args: unknown[]) =>
    isBundleAvailableInCountryMock(...args),
}));

const trackPlanPurchaseStartMock = jest.fn();
jest.mock("../../functions/trackPurchase", () => ({
  __esModule: true,
  trackPlanPurchaseStart: (...args: unknown[]) =>
    trackPlanPurchaseStartMock(...args),
}));

function setup(runtimeData?: RuntimeData) {
  const user = userEvent.setup();
  const utils = render(
    <BundleBanner
      runtimeData={runtimeData ?? ({} as unknown as RuntimeData)}
    />,
  );
  return { user, ...utils };
}

beforeEach(() => {
  jest.clearAllMocks();
  global.useL10nImpl = () => ({
    getString: (id: string, vars?: Record<string, unknown>) =>
      `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,
    getFragment: () => "",
    bundles: [{ locales: ["en-GB"] }],
  });
  global.gaEventMock = jest.fn();
});

describe("BundleBanner", () => {
  it("does not render the purchase section when bundle is unavailable", () => {
    isBundleAvailableInCountryMock.mockReturnValue(false);
    setup();
    expect(
      screen.queryByRole("link", {
        name: "l10n string: [bundle-banner-cta], with vars: {}",
      }),
    ).not.toBeInTheDocument();
  });

  it("renders header with price and CTA when bundle is available", () => {
    isBundleAvailableInCountryMock.mockReturnValue(true);
    getBundlePriceMock.mockReturnValue("$9.99");
    getBundleSubscribeLinkMock.mockReturnValue("https://example.com/subscribe");
    setup();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /l10n string: \[bundle-banner-header-2], with vars:/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/"monthly_price":"\$9\.99"/)).toBeInTheDocument();

    const cta = screen.getByRole("link", {
      name: "l10n string: [bundle-banner-cta], with vars: {}",
    });
    expect(cta).toHaveAttribute("href", "https://example.com/subscribe");
  });

  it("tracks purchase start on CTA click with expected args", async () => {
    isBundleAvailableInCountryMock.mockReturnValue(true);
    getBundlePriceMock.mockReturnValue("$9.99");
    getBundleSubscribeLinkMock.mockReturnValue("https://example.com/subscribe");
    const { user } = setup();

    const cta = screen.getByRole("link", {
      name: "l10n string: [bundle-banner-cta], with vars: {}",
    });
    await user.click(cta);

    expect(trackPlanPurchaseStartMock).toHaveBeenCalledTimes(1);
    const [gaFnArg, planArg, optsArg] =
      trackPlanPurchaseStartMock.mock.calls[0];
    expect(gaFnArg).toBe(global.gaEventMock);
    expect(planArg).toEqual({ plan: "bundle" });
    expect(optsArg).toEqual({ label: "bundle-banner-upgrade-promo" });
  });

  it("renders floating features and product list", () => {
    isBundleAvailableInCountryMock.mockReturnValue(true);
    getBundlePriceMock.mockReturnValue("$9.99");
    getBundleSubscribeLinkMock.mockReturnValue("https://example.com/subscribe");
    setup();

    expect(screen.getAllByTestId("svg-icon").length).toBeGreaterThanOrEqual(3);
    expect(
      screen.getByText(
        /\[<Localized> with id \[bundle-banner-money-back-guarantee\] and vars:/,
      ),
    ).toBeInTheDocument();
  });
});
