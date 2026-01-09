import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockNextRouter } from "../../../../__mocks__/modules/next__router";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithPeriodicalPremium,
  getMockRuntimeDataWithoutPremium,
} from "../../../../__mocks__/hooks/api/runtimeData";
import { HolidayPromoBanner } from "./HolidayPromoBanner";

jest.mock("next/router", () => mockNextRouter);
jest.mock("../../../hooks/gaEvent.ts");
jest.mock("../../../hooks/gaViewPing.ts", () => ({
  useGaViewPing: () => ({ current: null }),
}));
jest.mock("../../../hooks/utmApplier.ts", () => ({
  useUtmApplier: () => (url: string) => url,
}));

const mockHolidayDate = () => {
  const realDate = Date;
  const mockDate = new realDate("2023-12-15");
  global.Date = class extends realDate {
    constructor(...args: any[]) {
      super();
      if (args.length === 0) {
        return mockDate as any;
      }
      return new realDate(...args) as any;
    }
    static now() {
      return mockDate.getTime();
    }
  } as DateConstructor;
  return realDate;
};

describe("HolidayPromoBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();
    const useRouter = (jest.requireMock("next/router") as any).useRouter;
    useRouter.mockReturnValue({ pathname: "/", push: jest.fn() });
  });

  it("respects visibility conditions", () => {
    const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
    const profile = getMockProfileData({ has_premium: false });
    const useRouter = (jest.requireMock("next/router") as any).useRouter;

    const { container: loading } = render(
      <HolidayPromoBanner
        isLoading={true}
        runtimeData={runtimeData}
        profile={undefined}
      />,
    );
    expect(loading.firstChild).toBeNull();

    const { container: noPremium } = render(
      <HolidayPromoBanner
        isLoading={false}
        runtimeData={getMockRuntimeDataWithoutPremium()}
        profile={undefined}
      />,
    );
    expect(noPremium.firstChild).toBeNull();

    const { container: noRuntime } = render(
      <HolidayPromoBanner
        isLoading={false}
        runtimeData={undefined}
        profile={undefined}
      />,
    );
    expect(noRuntime.firstChild).toBeNull();

    useRouter.mockReturnValue({ pathname: "/", push: jest.fn() });
    const { container: wrongPath } = render(
      <HolidayPromoBanner
        isLoading={false}
        runtimeData={runtimeData}
        profile={profile}
      />,
    );
    expect(wrongPath.firstChild).toBeNull();

    const realDate = mockHolidayDate();
    useRouter.mockReturnValue({ pathname: "/premium", push: jest.fn() });
    const { container: visible } = render(
      <HolidayPromoBanner
        isLoading={false}
        runtimeData={runtimeData}
        profile={profile}
      />,
    );
    expect(visible.querySelector("aside")).toBeInTheDocument();
    global.Date = realDate;
  });

  it("renders complete banner with tracking", async () => {
    const realDate = mockHolidayDate();
    const user = userEvent.setup();
    const runtimeData = getMockRuntimeDataWithPeriodicalPremium();

    render(
      <HolidayPromoBanner
        isLoading={false}
        runtimeData={runtimeData}
        profile={undefined}
      />,
    );

    expect(
      screen.getByText(/holiday-promo-banner-protect-inbox/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/holiday-promo-banner-code-desc/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/holiday-promo-banner-code-usage/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/holiday-promo-banner-promo-expiry/),
    ).toBeInTheDocument();

    const ctaButton = screen.getByRole("link", {
      name: /holiday-promo-banner-cta-button/,
    });
    const href = ctaButton.getAttribute("href");
    expect(href).toContain("coupon=HOLIDAY20");
    expect(href).toContain("utm_source=fx-relay");
    expect(href).toContain("utm_campaign=relay-holiday-promo-2023");

    await user.click(ctaButton);
    expect(global.gaEventMock).toHaveBeenCalledWith({
      category: "Holiday Promotion Banner 2023",
      action: "Engage",
      label: "holiday-promo-banner-get-one-year-btn",
    });

    global.Date = realDate;
  });
});
