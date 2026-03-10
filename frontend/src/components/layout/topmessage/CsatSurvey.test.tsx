import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockCookiesModule } from "../../../../__mocks__/functions/cookies";
import { mockGetLocaleModule } from "../../../../__mocks__/functions/getLocale";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  mockFirstSeen,
  mockFirstSeenDaysAgo,
  mockCookieDismissal,
} from "../../../../__mocks__/testHelpers";

import { CsatSurvey } from "./CsatSurvey";

jest.mock("../../../functions/cookies.ts", () => mockCookiesModule);
jest.mock("../../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../../hooks/firstSeen.ts");
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);

describe("CsatSurvey", () => {
  describe("Survey visibility", () => {
    it("respects user age and dismissal state across free and premium tiers", () => {
      mockFirstSeen(new Date(Date.now()));
      const { container: newFree } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(within(newFree).queryByRole("button")).not.toBeInTheDocument();

      mockFirstSeenDaysAgo(7);
      const { container: weekOldFree } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(within(weekOldFree).getAllByRole("button")[0]).toBeInTheDocument();

      mockCookieDismissal("free-7days");
      const { container: dismissedFree } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(
        within(dismissedFree).queryByRole("button"),
      ).not.toBeInTheDocument();

      mockFirstSeenDaysAgo(30);
      mockCookieDismissal("free-7days");
      const { container: monthOldWithOldDismissal } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(
        within(monthOldWithOldDismissal).getAllByRole("button")[0],
      ).toBeInTheDocument();

      const newPremium = getMockProfileData({
        has_premium: true,
        date_subscribed: new Date(Date.now()).toISOString(),
      });
      const { container: newPremiumContainer } = render(
        <CsatSurvey profile={newPremium} />,
      );
      expect(
        within(newPremiumContainer).queryByRole("button"),
      ).not.toBeInTheDocument();

      const weekOldPremium = getMockProfileData({
        has_premium: true,
        date_subscribed: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      const { container: weekOldPremiumContainer } = render(
        <CsatSurvey profile={weekOldPremium} />,
      );
      expect(
        within(weekOldPremiumContainer).getAllByRole("button")[0],
      ).toBeInTheDocument();
    });

    it("handles edge cases", () => {
      const useFirstSeen = (
        jest.requireMock("../../../hooks/firstSeen.ts") as {
          useFirstSeen: jest.Mock;
        }
      ).useFirstSeen;
      const getLocale = (
        jest.requireMock("../../../functions/getLocale.ts") as {
          getLocale: jest.Mock;
        }
      ).getLocale;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as {
          getCookie: jest.Mock;
        }
      ).getCookie;

      useFirstSeen.mockReturnValue(new Date(0));
      getLocale.mockReturnValue("fr");
      getCookie.mockReturnValue(undefined);
      const { container: validLocale } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(within(validLocale).getAllByRole("button")[0]).toBeInTheDocument();

      getLocale.mockReturnValue("fy");
      const { container: invalidLocale } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(
        within(invalidLocale).queryByRole("button"),
      ).not.toBeInTheDocument();

      useFirstSeen.mockReturnValue(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      );
      getLocale.mockReturnValue("en");
      const unknownSubDate = getMockProfileData({
        has_premium: true,
        date_subscribed: null,
      });
      const { container: unknownDateContainer } = render(
        <CsatSurvey profile={unknownSubDate} />,
      );
      expect(
        within(unknownDateContainer).getAllByRole("button")[0],
      ).toBeInTheDocument();

      useFirstSeen.mockReturnValue(
        new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1001),
      );
      getCookie.mockImplementation((key: string) =>
        key.includes("free-90days")
          ? Date.now() - 3 * 30 * 24 * 60 * 60 * 1001
          : undefined,
      );
      const { container: reShowAfterTime } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(
        within(reShowAfterTime).getAllByRole("button")[0],
      ).toBeInTheDocument();
    });
  });

  describe("User interactions", () => {
    it("handles complete survey submission flow", async () => {
      const useFirstSeen = (
        jest.requireMock("../../../hooks/firstSeen.ts") as {
          useFirstSeen: jest.Mock;
        }
      ).useFirstSeen;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as {
          getCookie: jest.Mock;
        }
      ).getCookie;

      useFirstSeen.mockReturnValue(new Date(0));
      getCookie.mockReturnValue(undefined);
      global.gaEventMock?.mockClear();

      const user = userEvent.setup();
      render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );

      expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      expect(
        screen.getAllByTitle(/survey-option-dismiss/).length,
      ).toBeGreaterThan(0);

      const satisfiedButton = screen.getByRole("button", {
        name: /survey-csat-answer-satisfied.*(?!very)/,
      });
      await user.click(satisfiedButton);

      expect(global.gaEventMock).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "CSAT Survey",
          action: "submitted",
          label: "Satisfied",
        }),
      );

      const followUpLink = await screen.findByRole("link");
      expect(followUpLink).toHaveAttribute(
        "href",
        expect.stringContaining("6665054"),
      );
      expect(followUpLink).toHaveAttribute("target", "_blank");

      expect(
        screen.queryAllByRole("button", { name: /survey-csat-answer/ }),
      ).toHaveLength(0);
    });

    it("allows dismissal without answering", async () => {
      const useFirstSeen = (
        jest.requireMock("../../../hooks/firstSeen.ts") as {
          useFirstSeen: jest.Mock;
        }
      ).useFirstSeen;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as {
          getCookie: jest.Mock;
        }
      ).getCookie;

      useFirstSeen.mockReturnValue(new Date(0));
      getCookie.mockReturnValue(undefined);

      const user = userEvent.setup();
      render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );

      const dismissButtons = screen.getAllByTitle(/survey-option-dismiss/);
      await user.click(dismissButtons[0]);
    });
  });
});
