import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MegabundleBanner } from "./MegaBundleBanner";
import { trackPlanPurchaseStart } from "../../functions/trackPurchase";
import type { RuntimeDataWithBundleAvailable } from "../../functions/getPlan";

// Mock icons
jest.mock("./images/vpn-icon.svg", () => ({ src: "vpn-icon.svg" }));
jest.mock("./images/relay-icon.svg", () => ({ src: "relay-icon.svg" }));
jest.mock("./images/monitor-icon.svg", () => ({ src: "monitor-icon.svg" }));

// Mock functions
jest.mock("../../functions/getPlan", () => ({
  isMegabundleAvailableInCountry: jest.fn(),
  getMegabundlePrice: jest.fn(),
  getMegabundleSubscribeLink: jest.fn(),
  getMegabundleYearlyPrice: jest.fn(),
}));

jest.mock("../../functions/trackPurchase", () => ({
  trackPlanPurchaseStart: jest.fn(),
}));

// Import after mocks
import {
  isMegabundleAvailableInCountry,
  getMegabundlePrice,
  getMegabundleSubscribeLink,
  getMegabundleYearlyPrice,
} from "../../functions/getPlan";

const mockRuntimeData: RuntimeDataWithBundleAvailable = {
  FXA_ORIGIN: "https://fxa-mock.com",
  GOOGLE_ANALYTICS_ID: "UA-000000-2",
  GA4_MEASUREMENT_ID: "G-XXXXXXX",
  PERIODICAL_PREMIUM_PRODUCT_ID: "prod_dummy1",
  PHONE_PRODUCT_ID: "prod_dummy2",
  BUNDLE_PRODUCT_ID: "prod_123456789",
  MEGABUNDLE_PRODUCT_ID: "prod_123456789",
  BASKET_ORIGIN: "https://basket.mozilla.test",
  WAFFLE_FLAGS: [],
  MAX_MINUTES_TO_VERIFY_REAL_PHONE: 10,
  PERIODICAL_PREMIUM_PLANS: {
    country_code: "US",
    countries: ["US"],
    available_in_country: true,
    plan_country_lang_mapping: {},
  },
  PHONE_PLANS: {
    country_code: "US",
    countries: ["US"],
    available_in_country: true,
    plan_country_lang_mapping: {},
  },
  BUNDLE_PLANS: {
    country_code: "US",
    countries: ["US"],
    available_in_country: true,
    plan_country_lang_mapping: {},
  },
  MEGABUNDLE_PLANS: {
    country_code: "US",
    countries: ["US"],
    available_in_country: true,
    plan_country_lang_mapping: {
      US: {
        en: {
          yearly: {
            id: "price_1RMAopKb9q6OnNsLSGe1vLtt",
            price: 8.25,
            currency: "USD",
            url: "https://subscribe.com",
          },
        },
      },
    },
  },
};

describe("MegabundleBanner", () => {
  const getStringMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    getStringMock.mockImplementation((key: string, vars?: string) => {
      if (vars) return `${key} ${JSON.stringify(vars)}`;
      return key;
    });

    (isMegabundleAvailableInCountry as unknown as jest.Mock).mockReturnValue(
      true,
    );
    (getMegabundlePrice as jest.Mock).mockReturnValue("$9.99");
    (getMegabundleSubscribeLink as jest.Mock).mockReturnValue(
      "https://subscribe.com",
    );
    (getMegabundleYearlyPrice as jest.Mock).mockReturnValue("$99.99");
  });

  it("renders the banner when available in country", () => {
    render(<MegabundleBanner runtimeData={mockRuntimeData} />);

    expect(
      screen.getByRole("heading", {
        name: /megabundle-banner-header/,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /megabundle-banner-cta/ }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/megabundle-banner-plan-modules-vpn/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/megabundle-banner-plan-modules-monitor/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/megabundle-banner-plan-modules-relay/),
    ).toBeInTheDocument();
  });

  it("does not render the banner if not available in country", () => {
    (isMegabundleAvailableInCountry as unknown as jest.Mock).mockReturnValue(
      false,
    );

    render(<MegabundleBanner runtimeData={mockRuntimeData} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByText(/megabundle-banner-cta/)).not.toBeInTheDocument();
  });

  it("fires trackPlanPurchaseStart on button click", async () => {
    const user = userEvent.setup();
    render(<MegabundleBanner runtimeData={mockRuntimeData} />);

    await user.click(
      screen.getByRole("link", { name: /megabundle-banner-cta/ }),
    );

    expect(trackPlanPurchaseStart).toHaveBeenCalledWith(
      expect.any(Function),
      { plan: "megabundle" },
      { label: "megabundle-banner-upgrade-promo" },
    );
  });

  it("shows annual billing and guarantee text", () => {
    render(<MegabundleBanner runtimeData={mockRuntimeData} />);

    expect(
      screen.getByText(/megabundle-banner-billed-annually/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/megabundle-banner-money-back-guarantee/),
    ).toBeInTheDocument();
  });
});
