import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  mockFirstSeenDaysAgo,
  mockFirstSeen,
  mockLocalDismissal,
  mockLoginStatus,
} from "../../../../__mocks__/testHelpers";
import { NpsSurvey } from "./NpsSurvey";

jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../hooks/gaEvent.ts");
jest.mock("../../../hooks/localDismissal.ts");
jest.mock("../../../hooks/firstSeen.ts");
jest.mock("../../../hooks/session.ts");
jest.mock("../../../hooks/api/profile.ts");

describe("NpsSurvey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();
    mockLocalDismissal(false);
    mockFirstSeenDaysAgo(4);
    mockLoginStatus("logged-in");
    const useProfiles = (
      jest.requireMock("../../../hooks/api/profile.ts") as {
        useProfiles: jest.Mock;
      }
    ).useProfiles;
    useProfiles.mockReturnValue({ data: [getMockProfileData({ id: 123 })] });
  });

  it("respects visibility conditions", () => {
    render(<NpsSurvey />);
    expect(screen.getByRole("complementary")).toBeInTheDocument();

    mockLocalDismissal(true);
    const { container: dismissed } = render(<NpsSurvey />);
    expect(dismissed).toBeEmptyDOMElement();

    mockLocalDismissal(false);
    mockFirstSeen(new Date(Date.now() - 1000));
    const { container: tooNew } = render(<NpsSurvey />);
    expect(tooNew).toBeEmptyDOMElement();

    mockFirstSeenDaysAgo(4);
    mockLoginStatus("logged-out");
    const { container: loggedOut } = render(<NpsSurvey />);
    expect(loggedOut).toBeEmptyDOMElement();

    mockLoginStatus("logged-in");
    mockFirstSeen(null);
    const { container: noFirstSeen } = render(<NpsSurvey />);
    expect(noFirstSeen).toBeEmptyDOMElement();

    mockFirstSeenDaysAgo(4);
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as {
        useLocalDismissal: jest.Mock;
      }
    ).useLocalDismissal;
    expect(useLocalDismissal).toHaveBeenCalledWith("nps-survey_123", {
      duration: 30 * 24 * 60 * 60,
    });
  });

  it("renders complete survey with rating categories and tracking", async () => {
    const mockDismiss = jest.fn();
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as {
        useLocalDismissal: jest.Mock;
      }
    ).useLocalDismissal;
    useLocalDismissal.mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });

    const user = userEvent.setup();
    render(<NpsSurvey />);

    expect(screen.getByText(/survey-question-1/)).toBeInTheDocument();
    expect(screen.getByText(/survey-option-not-likely/)).toBeInTheDocument();
    expect(screen.getByText(/survey-option-very-likely/)).toBeInTheDocument();

    for (let i = 1; i <= 10; i++) {
      expect(
        screen.getByRole("button", { name: i.toString() }),
      ).toBeInTheDocument();
    }

    await user.click(screen.getByRole("button", { name: "9" }));
    expect(global.gaEventMock).toHaveBeenCalledWith({
      category: "NPS Survey",
      action: "submitted",
      label: "promoter",
      value: 9,
      dimension1: "promoter",
      metric1: 1,
      metric2: 9,
      metric3: 1,
    });
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it("handles dismissal without tracking", async () => {
    const mockDismiss = jest.fn();
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as {
        useLocalDismissal: jest.Mock;
      }
    ).useLocalDismissal;
    useLocalDismissal.mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });

    const user = userEvent.setup();
    render(<NpsSurvey />);

    const allButtons = screen.getAllByRole("button");
    const dismissButton = allButtons.find((btn) =>
      btn.getAttribute("title")?.includes("survey-option-dismiss"),
    );
    await user.click(dismissButton!);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(global.gaEventMock).not.toHaveBeenCalled();
  });
});
