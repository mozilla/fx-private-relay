import { render, screen } from "@testing-library/react";
import { mockNextRouter } from "../../../../__mocks__/modules/next__router";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithPeriodicalPremium,
  getMockRuntimeDataWithPhones,
} from "../../../../__mocks__/hooks/api/runtimeData";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { TopMessage } from "./TopMessage";

jest.mock("next/router", () => mockNextRouter);
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../functions/waffle.ts", () => ({
  isFlagActive: jest.fn(),
}));
jest.mock("../../../functions/getLocale.ts", () => ({
  getLocale: jest.fn(),
}));
jest.mock("./InterviewRecruitment", () => ({
  InterviewRecruitment: () => (
    <div data-testid="interview-recruitment">Interview Recruitment</div>
  ),
}));
jest.mock("./PhoneSurvey", () => ({
  PhoneSurvey: () => <div data-testid="phone-survey">Phone Survey</div>,
}));
jest.mock("./CsatSurvey", () => ({
  CsatSurvey: () => <div data-testid="csat-survey">CSAT Survey</div>,
}));

describe("<TopMessage>", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    const useRouter =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("next/router") as any).useRouter;
    useRouter.mockReturnValue({
      pathname: "/",
      push: jest.fn(),
    });

    const isFlagActive =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
    isFlagActive.mockReturnValue(false);

    const getLocale =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/getLocale.ts") as any).getLocale;
    getLocale.mockReturnValue("en-US");
  });

  describe("InterviewRecruitment conditions", () => {
    it("renders InterviewRecruitment when all conditions are met", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("interview-recruitment")).toBeInTheDocument();
    });

    it("does not render InterviewRecruitment when flag is inactive", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(false);

      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(
        screen.queryByTestId("interview-recruitment"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render InterviewRecruitment when not on dashboard", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/premium",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(
        screen.queryByTestId("interview-recruitment"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render InterviewRecruitment when user is not from US", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "ca";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(
        screen.queryByTestId("interview-recruitment"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render InterviewRecruitment when user does not speak English", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const getLocale =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/getLocale.ts") as any).getLocale;
      getLocale.mockReturnValue("fr-FR");

      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(
        screen.queryByTestId("interview-recruitment"),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render InterviewRecruitment when profile is undefined", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "US";

      render(<TopMessage profile={undefined} runtimeData={runtimeData} />);

      expect(
        screen.queryByTestId("interview-recruitment"),
      ).not.toBeInTheDocument();
    });
  });

  describe("PhoneSurvey conditions", () => {
    it("renders PhoneSurvey when all conditions are met", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
    });

    it("renders PhoneSurvey for Canadian users", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "ca";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
    });

    it("does not render PhoneSurvey when flag is inactive", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(false);

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render PhoneSurvey when user does not have phone plan", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const profile = getMockProfileData({ has_phone: false });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render PhoneSurvey when user is not from US or CA", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "uk";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("does not render PhoneSurvey when user does not speak English", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const getLocale =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/getLocale.ts") as any).getLocale;
      getLocale.mockReturnValue("de-DE");

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });
  });

  describe("CsatSurvey fallback", () => {
    it("renders CsatSurvey when profile exists and no other conditions met", () => {
      const profile = getMockProfileData({ has_premium: false });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });

    it("renders CsatSurvey with the profile prop", () => {
      const profile = getMockProfileData({ has_premium: true });
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    });
  });

  describe("No profile", () => {
    it("renders nothing when profile is undefined", () => {
      const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
      const { container } = render(
        <TopMessage profile={undefined} runtimeData={runtimeData} />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when both profile and runtimeData are undefined", () => {
      const { container } = render(
        <TopMessage profile={undefined} runtimeData={undefined} />,
      );

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Priority order", () => {
    it("prioritizes InterviewRecruitment over PhoneSurvey", () => {
      const useRouter =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("next/router") as any).useRouter;
      useRouter.mockReturnValue({
        pathname: "/accounts/profile",
        push: jest.fn(),
      });

      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockReturnValue(true);

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("interview-recruitment")).toBeInTheDocument();
      expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
      expect(screen.queryByTestId("csat-survey")).not.toBeInTheDocument();
    });

    it("prioritizes PhoneSurvey over CsatSurvey", () => {
      const isFlagActive =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../functions/waffle.ts") as any).isFlagActive;
      isFlagActive.mockImplementation((runtimeData, flag) => {
        return flag === "phone_launch_survey";
      });

      const profile = getMockProfileData({ has_phone: true });
      const runtimeData = getMockRuntimeDataWithPhones();
      runtimeData.PHONE_PLANS.country_code = "us";

      render(<TopMessage profile={profile} runtimeData={runtimeData} />);

      expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
      expect(screen.queryByTestId("csat-survey")).not.toBeInTheDocument();
    });
  });
});
