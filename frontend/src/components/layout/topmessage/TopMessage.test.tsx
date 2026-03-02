import { render, screen } from "@testing-library/react";
import { mockNextRouter } from "../../../../__mocks__/modules/next__router";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithPeriodicalPremium,
  getMockRuntimeDataWithPhones,
} from "../../../../__mocks__/hooks/api/runtimeData";
import { TopMessage } from "./TopMessage";

jest.mock("next/router", () => mockNextRouter);
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

describe("TopMessage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const useRouter = (
      jest.requireMock("next/router") as { useRouter: jest.Mock }
    ).useRouter;
    useRouter.mockReturnValue({ pathname: "/", push: jest.fn() });
    const isFlagActive = (
      jest.requireMock("../../../functions/waffle.ts") as {
        isFlagActive: jest.Mock;
      }
    ).isFlagActive;
    isFlagActive.mockReturnValue(false);
    const getLocale = (
      jest.requireMock("../../../functions/getLocale.ts") as {
        getLocale: jest.Mock;
      }
    ).getLocale;
    getLocale.mockReturnValue("en-US");
  });

  it("renders InterviewRecruitment based on conditions", () => {
    const useRouter = (
      jest.requireMock("next/router") as { useRouter: jest.Mock }
    ).useRouter;
    const isFlagActive = (
      jest.requireMock("../../../functions/waffle.ts") as {
        isFlagActive: jest.Mock;
      }
    ).isFlagActive;
    const getLocale = (
      jest.requireMock("../../../functions/getLocale.ts") as {
        getLocale: jest.Mock;
      }
    ).getLocale;
    const profile = getMockProfileData({ has_premium: false });
    const runtimeData = getMockRuntimeDataWithPeriodicalPremium();
    runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";

    useRouter.mockReturnValue({
      pathname: "/accounts/profile",
      push: jest.fn(),
    });
    isFlagActive.mockReturnValue(true);
    let view = render(
      <TopMessage profile={profile} runtimeData={runtimeData} />,
    );
    expect(screen.getByTestId("interview-recruitment")).toBeInTheDocument();
    view.unmount();

    isFlagActive.mockReturnValue(false);
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(
      screen.queryByTestId("interview-recruitment"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    view.unmount();

    isFlagActive.mockReturnValue(true);
    useRouter.mockReturnValue({ pathname: "/premium", push: jest.fn() });
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(
      screen.queryByTestId("interview-recruitment"),
    ).not.toBeInTheDocument();
    view.unmount();

    useRouter.mockReturnValue({
      pathname: "/accounts/profile",
      push: jest.fn(),
    });
    runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "ca";
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(
      screen.queryByTestId("interview-recruitment"),
    ).not.toBeInTheDocument();
    view.unmount();

    runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";
    getLocale.mockReturnValue("fr-FR");
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(
      screen.queryByTestId("interview-recruitment"),
    ).not.toBeInTheDocument();
    view.unmount();

    getLocale.mockReturnValue("en-US");
    view = render(<TopMessage profile={undefined} runtimeData={runtimeData} />);
    expect(
      screen.queryByTestId("interview-recruitment"),
    ).not.toBeInTheDocument();
  });

  it("renders PhoneSurvey based on conditions", () => {
    const isFlagActive = (
      jest.requireMock("../../../functions/waffle.ts") as {
        isFlagActive: jest.Mock;
      }
    ).isFlagActive;
    const getLocale = (
      jest.requireMock("../../../functions/getLocale.ts") as {
        getLocale: jest.Mock;
      }
    ).getLocale;
    const profile = getMockProfileData({ has_phone: true });
    const runtimeData = getMockRuntimeDataWithPhones();

    isFlagActive.mockImplementation(
      (_, flag) => flag === "phone_launch_survey",
    );
    runtimeData.PHONE_PLANS.country_code = "us";
    let view = render(
      <TopMessage profile={profile} runtimeData={runtimeData} />,
    );
    expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
    view.unmount();

    runtimeData.PHONE_PLANS.country_code = "ca";
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
    view.unmount();

    isFlagActive.mockReturnValue(false);
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
    expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    view.unmount();

    isFlagActive.mockImplementation(
      (_, flag) => flag === "phone_launch_survey",
    );
    const noPhoneProfile = getMockProfileData({ has_phone: false });
    view = render(
      <TopMessage profile={noPhoneProfile} runtimeData={runtimeData} />,
    );
    expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
    view.unmount();

    runtimeData.PHONE_PLANS.country_code = "uk";
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
    view.unmount();

    runtimeData.PHONE_PLANS.country_code = "us";
    getLocale.mockReturnValue("de-DE");
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
  });

  it("handles fallback and no profile scenarios", () => {
    const profile = getMockProfileData({ has_premium: false });
    const runtimeData = getMockRuntimeDataWithPeriodicalPremium();

    let view = render(
      <TopMessage profile={profile} runtimeData={runtimeData} />,
    );
    expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    view.unmount();

    const premiumProfile = getMockProfileData({ has_premium: true });
    view = render(
      <TopMessage profile={premiumProfile} runtimeData={runtimeData} />,
    );
    expect(screen.getByTestId("csat-survey")).toBeInTheDocument();
    view.unmount();

    const { container: noProfile } = render(
      <TopMessage profile={undefined} runtimeData={runtimeData} />,
    );
    expect(noProfile).toBeEmptyDOMElement();

    const { container: nothingDefined } = render(
      <TopMessage profile={undefined} runtimeData={undefined} />,
    );
    expect(nothingDefined).toBeEmptyDOMElement();
  });

  it("respects priority order", () => {
    const useRouter = (
      jest.requireMock("next/router") as { useRouter: jest.Mock }
    ).useRouter;
    const isFlagActive = (
      jest.requireMock("../../../functions/waffle.ts") as {
        isFlagActive: jest.Mock;
      }
    ).isFlagActive;

    useRouter.mockReturnValue({
      pathname: "/accounts/profile",
      push: jest.fn(),
    });
    isFlagActive.mockReturnValue(true);
    const profile = getMockProfileData({ has_phone: true });
    const runtimeData = getMockRuntimeDataWithPhones();
    runtimeData.PERIODICAL_PREMIUM_PLANS.country_code = "us";
    runtimeData.PHONE_PLANS.country_code = "us";

    let view = render(
      <TopMessage profile={profile} runtimeData={runtimeData} />,
    );
    expect(screen.getByTestId("interview-recruitment")).toBeInTheDocument();
    expect(screen.queryByTestId("phone-survey")).not.toBeInTheDocument();
    expect(screen.queryByTestId("csat-survey")).not.toBeInTheDocument();
    view.unmount();

    isFlagActive.mockImplementation(
      (_, flag) => flag === "phone_launch_survey",
    );
    view = render(<TopMessage profile={profile} runtimeData={runtimeData} />);
    expect(screen.getByTestId("phone-survey")).toBeInTheDocument();
    expect(screen.queryByTestId("csat-survey")).not.toBeInTheDocument();
  });
});
