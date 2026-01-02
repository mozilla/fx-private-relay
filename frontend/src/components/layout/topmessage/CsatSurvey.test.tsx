import { render, screen } from "@testing-library/react";
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
      expect(newFree.querySelector("button")).toBeNull();

      mockFirstSeenDaysAgo(7);
      const { container: weekOldFree } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(weekOldFree.querySelector("button")).toBeTruthy();

      mockCookieDismissal("free-7days");
      const { container: dismissedFree } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(dismissedFree.querySelector("button")).toBeNull();

      mockFirstSeenDaysAgo(30);
      mockCookieDismissal("free-7days");
      const { container: monthOldWithOldDismissal } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(monthOldWithOldDismissal.querySelector("button")).toBeTruthy();

      const newPremium = getMockProfileData({
        has_premium: true,
        date_subscribed: new Date(Date.now()).toISOString(),
      });
      const { container: newPremiumContainer } = render(
        <CsatSurvey profile={newPremium} />,
      );
      expect(newPremiumContainer.querySelector("button")).toBeNull();

      const weekOldPremium = getMockProfileData({
        has_premium: true,
        date_subscribed: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      const { container: weekOldPremiumContainer } = render(
        <CsatSurvey profile={weekOldPremium} />,
      );
      expect(weekOldPremiumContainer.querySelector("button")).toBeTruthy();
    });

    it("handles edge cases", () => {
      const useFirstSeen = (
        jest.requireMock("../../../hooks/firstSeen.ts") as any
      ).useFirstSeen;
      const getLocale = (
        jest.requireMock("../../../functions/getLocale.ts") as any
      ).getLocale;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as any
      ).getCookie;

      useFirstSeen.mockReturnValue(new Date(0));
      getLocale.mockReturnValue("fr");
      getCookie.mockReturnValue(undefined);
      const { container: validLocale } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(validLocale.querySelector("button")).toBeTruthy();

      getLocale.mockReturnValue("fy");
      const { container: invalidLocale } = render(
        <CsatSurvey profile={getMockProfileData({ has_premium: false })} />,
      );
      expect(invalidLocale.querySelector("button")).toBeNull();

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
      expect(unknownDateContainer.querySelector("button")).toBeTruthy();

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
      expect(reShowAfterTime.querySelector("button")).toBeTruthy();
    });
  });

  describe("User interactions", () => {
    it("handles complete survey submission flow", async () => {
      const useFirstSeen = (
        jest.requireMock("../../../hooks/firstSeen.ts") as any
      ).useFirstSeen;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as any
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
        jest.requireMock("../../../hooks/firstSeen.ts") as any
      ).useFirstSeen;
      const getCookie: jest.Mock = (
        jest.requireMock("../../../functions/cookies.ts") as any
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
