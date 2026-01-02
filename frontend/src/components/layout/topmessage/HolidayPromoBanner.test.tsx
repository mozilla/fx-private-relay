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

describe("HolidayPromoBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();

    const useRouter =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("next/router") as any).useRouter;
    useRouter.mockReturnValue({
      pathname: "/",
      push: jest.fn(),
    });
  });

  describe("Visibility conditions", () => {
    it("does not render when isLoading is true", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      const { container } = render(
        <HolidayPromoBanner
          isLoading={true}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when periodical premium is not available in country", () => {
      const runtimeData = getMockRuntimeDataWithoutPremium();
      const { container } = render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when profile exists and pathname is not /premium", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      const profile = getMockProfileData({ has_premium: false });
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/",
        push: jest.fn(),
      });

      const { container } = render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={profile}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when runtimeData is undefined", () => {
      const { container } = render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={undefined}
          profile={undefined}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("renders when profile exists and pathname is /premium (when date mocked)", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      const profile = getMockProfileData({ has_premium: false });
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/premium",
        push: jest.fn(),
      });

      const realDate = Date;
      const mockDate = new realDate("2023-12-15");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.Date = class extends realDate {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
          super();
          if (args.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return mockDate as any;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return new realDate(...args) as any;
        }
        static now() {
          return mockDate.getTime();
        }
      } as DateConstructor;

      const { container } = render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={profile}
        />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).not.toBeNull();

      global.Date = realDate;
    });
  });

  describe("Content and interactions", () => {
    let realDate: DateConstructor;

    beforeEach(() => {
      realDate = Date;
      const mockDate = new realDate("2023-12-15");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      global.Date = class extends realDate {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor(...args: any[]) {
          super();
          if (args.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return mockDate as any;
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return new realDate(...args) as any;
        }
        static now() {
          return mockDate.getTime();
        }
      } as DateConstructor;
    });

    afterEach(() => {
      global.Date = realDate;
    });

    test.each([
      {
        textMatch: /holiday-promo-banner-protect-inbox/,
        description: "promo text",
      },
      {
        textMatch: /holiday-promo-banner-code-desc/,
        description: "code description",
      },
      {
        textMatch: /holiday-promo-banner-code-usage/,
        description: "coupon code",
      },
      {
        textMatch: /holiday-promo-banner-promo-expiry/,
        description: "promo expiry",
      },
    ])("renders $description", ({ textMatch }) => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      expect(screen.getByText(textMatch)).toBeInTheDocument();
    });

    it("renders CTA button with correct text", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      const ctaButton = screen.getByRole("link", {
        name: /holiday-promo-banner-cta-button/,
      });
      expect(ctaButton).toBeInTheDocument();
    });

    it("CTA button has correct href with coupon code and UTM params", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      const ctaButton = screen.getByRole("link", {
        name: /holiday-promo-banner-cta-button/,
      });
      const href = ctaButton.getAttribute("href");

      expect(href).toContain("coupon=HOLIDAY20");
      expect(href).toContain("utm_source=fx-relay");
      expect(href).toContain("utm_medium=banner");
      expect(href).toContain("utm_content=holiday-promo-banner-cta");
      expect(href).toContain("utm_campaign=relay-holiday-promo-2023");
    });

    it("tracks GA event when CTA button is clicked", async () => {
      const user = userEvent.setup();
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      const ctaButton = screen.getByRole("link", {
        name: /holiday-promo-banner-cta-button/,
      });
      await user.click(ctaButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "Holiday Promotion Banner 2023",
        action: "Engage",
        label: "holiday-promo-banner-get-one-year-btn",
      });
    });

    it("renders with proper structure", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      const { container } = render(
        <HolidayPromoBanner
          isLoading={false}
          runtimeData={runtimeData}
          profile={undefined}
        />,
      );

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const aside = container.querySelector("aside");
      expect(aside).toBeInTheDocument();
    });
  });
});
