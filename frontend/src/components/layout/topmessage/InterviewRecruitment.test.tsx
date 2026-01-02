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

describe("<InterviewRecruitment>", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();

    const useLocalDismissal =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/localDismissal.ts") as any)
        .useLocalDismissal;
    useLocalDismissal.mockReturnValue({
      isDismissed: false,
      dismiss: jest.fn(),
    });
  });

  describe("Visibility conditions", () => {
    it("renders when not dismissed", () => {
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;
      useLocalDismissal.mockReturnValue({
        isDismissed: false,
        dismiss: jest.fn(),
      });

      const { container } = render(<InterviewRecruitment />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).not.toBeNull();
    });

    it("does not render when dismissed", () => {
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;
      useLocalDismissal.mockReturnValue({
        isDismissed: true,
        dismiss: jest.fn(),
      });

      const { container } = render(<InterviewRecruitment />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("uses correct dismissal key", () => {
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;

      render(<InterviewRecruitment />);

      expect(useLocalDismissal).toHaveBeenCalledWith(
        "interview-recruitment-2022-08",
      );
    });
  });

  describe("Content rendering", () => {
    it("renders the recruitment message", () => {
      render(<InterviewRecruitment />);

      const message = screen.getByText(
        /Want to help improve Firefox Relay\? We'd love to hear what you think/,
      );
      expect(message).toBeInTheDocument();
    });

    it("renders the full recruitment text with gift card information", () => {
      render(<InterviewRecruitment />);

      const message = screen.getByText(
        /Research participants receive a \$50 gift card/,
      );
      expect(message).toBeInTheDocument();
    });

    it("renders recruitment link with correct href", () => {
      render(<InterviewRecruitment />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "https://survey.alchemer.com/s3/6963482/Firefox-Relay-Research-Study-h2-2022",
      );
    });

    it("renders recruitment link with target blank", () => {
      render(<InterviewRecruitment />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders dismiss button", () => {
      render(<InterviewRecruitment />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toBeInTheDocument();
    });

    it("renders CloseIcon in dismiss button", () => {
      render(<InterviewRecruitment />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toHaveAttribute(
        "title",
        expect.stringContaining("survey-option-dismiss"),
      );
    });
  });

  describe("User interactions", () => {
    it("tracks GA event when recruitment link is clicked", async () => {
      const user = userEvent.setup();
      render(<InterviewRecruitment />);

      const link = screen.getByRole("link");
      await user.click(link);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "Recruitment",
        action: "Engage",
        label:
          "Want to help improve Firefox Relay? We'd love to hear what you think. Research participants receive a $50 gift card.",
      });
    });

    it("calls dismiss when close button is clicked", async () => {
      const user = userEvent.setup();
      const mockDismiss = jest.fn();
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;
      useLocalDismissal.mockReturnValue({
        isDismissed: false,
        dismiss: mockDismiss,
      });

      render(<InterviewRecruitment />);

      const dismissButton = screen.getByRole("button");
      await user.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith();
    });
  });

  describe("Localization", () => {
    it("uses localized dismiss button text", () => {
      render(<InterviewRecruitment />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toHaveAttribute("title");
    });

    it("passes correct l10n string to CloseIcon", () => {
      render(<InterviewRecruitment />);

      const dismissButton = screen.getByRole("button");
      const title = dismissButton.getAttribute("title");
      expect(title).toContain("survey-option-dismiss");
    });
  });

  describe("Structure and styling", () => {
    it("renders within an aside element", () => {
      const { container } = render(<InterviewRecruitment />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const aside = container.querySelector("aside");
      expect(aside).toBeInTheDocument();
    });

    it("renders recruitment link as the main content", () => {
      render(<InterviewRecruitment />);

      const link = screen.getByRole("link");
      expect(link).toHaveTextContent(
        "Want to help improve Firefox Relay? We'd love to hear what you think. Research participants receive a $50 gift card.",
      );
    });
  });
});
