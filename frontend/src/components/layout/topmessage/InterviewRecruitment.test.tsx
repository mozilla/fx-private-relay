import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { InterviewRecruitment } from "./InterviewRecruitment";

jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../hooks/gaEvent.ts");
jest.mock("../../../hooks/gaViewPing.ts", () => ({
  useGaViewPing: () => ({ current: null }),
}));
jest.mock("../../../hooks/localDismissal.ts");

describe("InterviewRecruitment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();
  });

  it("respects dismissal state", () => {
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as any
    ).useLocalDismissal;

    useLocalDismissal.mockReturnValue({
      isDismissed: true,
      dismiss: jest.fn(),
    });
    const { container: dismissed } = render(<InterviewRecruitment />);
    expect(dismissed.firstChild).toBeNull();

    useLocalDismissal.mockReturnValue({
      isDismissed: false,
      dismiss: jest.fn(),
    });
    const { container: visible } = render(<InterviewRecruitment />);
    expect(visible.querySelector("aside")).toBeInTheDocument();

    expect(useLocalDismissal).toHaveBeenCalledWith(
      "interview-recruitment-2022-08",
    );
  });

  it("renders complete banner with interactions and tracking", async () => {
    const mockDismiss = jest.fn();
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as any
    ).useLocalDismissal;
    useLocalDismissal.mockReturnValue({
      isDismissed: false,
      dismiss: mockDismiss,
    });

    const user = userEvent.setup();
    render(<InterviewRecruitment />);

    expect(
      screen.getByText(
        /Want to help improve Firefox Relay\? We'd love to hear what you think/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Research participants receive a \$50 gift card/),
    ).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://survey.alchemer.com/s3/6963482/Firefox-Relay-Research-Study-h2-2022",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(link);
    expect(global.gaEventMock).toHaveBeenCalledWith({
      category: "Recruitment",
      action: "Engage",
      label:
        "Want to help improve Firefox Relay? We'd love to hear what you think. Research participants receive a $50 gift card.",
    });

    const dismissButton = screen.getByRole("button");
    expect(dismissButton).toHaveAttribute(
      "title",
      expect.stringContaining("survey-option-dismiss"),
    );
    await user.click(dismissButton);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });
});
