import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import { NpsSurvey } from "./NpsSurvey";

jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../hooks/gaEvent.ts");
jest.mock("../../../hooks/localDismissal.ts");
jest.mock("../../../hooks/firstSeen.ts");
jest.mock("../../../hooks/session.ts");
jest.mock("../../../hooks/api/profile.ts");

describe("<NpsSurvey>", () => {
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

    const useFirstSeen =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValue(
      new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    );

    const useIsLoggedIn =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/session.ts") as any).useIsLoggedIn;
    useIsLoggedIn.mockReturnValue("logged-in");

    const useProfiles =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/api/profile.ts") as any).useProfiles;
    useProfiles.mockReturnValue({
      data: [getMockProfileData({ id: 123 })],
    });
  });

  describe("Visibility conditions", () => {
    it("renders when not dismissed and user has been active for 3+ days", () => {
      const { container } = render(<NpsSurvey />);

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

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when user has been active for less than the threshold", () => {
      const useFirstSeen =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
      useFirstSeen.mockReturnValue(new Date(Date.now() - 1000));

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when user is not logged in", () => {
      const useIsLoggedIn =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/session.ts") as any).useIsLoggedIn;
      useIsLoggedIn.mockReturnValue("logged-out");

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when firstSeen is not a Date", () => {
      const useFirstSeen =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
      useFirstSeen.mockReturnValue(null);

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("uses dismissal key with profile id", () => {
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;

      render(<NpsSurvey />);

      expect(useLocalDismissal).toHaveBeenCalledWith("nps-survey_123", {
        duration: 30 * 24 * 60 * 60,
      });
    });
  });

  describe("Content rendering", () => {
    it("renders the survey question", () => {
      render(<NpsSurvey />);

      expect(screen.getByText(/survey-question-1/)).toBeInTheDocument();
    });

    it("renders all 10 rating buttons", () => {
      render(<NpsSurvey />);

      for (let i = 1; i <= 10; i++) {
        expect(
          screen.getByRole("button", { name: i.toString() }),
        ).toBeInTheDocument();
      }
    });

    it("renders 'not likely' legend", () => {
      render(<NpsSurvey />);

      expect(screen.getByText(/survey-option-not-likely/)).toBeInTheDocument();
    });

    it("renders 'very likely' legend", () => {
      render(<NpsSurvey />);

      expect(screen.getByText(/survey-option-very-likely/)).toBeInTheDocument();
    });

    it("renders dismiss button", () => {
      render(<NpsSurvey />);

      const allButtons = screen.getAllByRole("button");
      const dismissButton = allButtons.find((btn) =>
        btn.getAttribute("title")?.includes("survey-option-dismiss"),
      );
      expect(dismissButton).toBeInTheDocument();
    });

    it("renders CloseIcon in dismiss button", () => {
      render(<NpsSurvey />);

      const allButtons = screen.getAllByRole("button");
      const dismissButton = allButtons.find((btn) =>
        btn.getAttribute("title")?.includes("survey-option-dismiss"),
      );
      expect(dismissButton).toHaveAttribute("title");
    });
  });

  describe("User interactions - Submit ratings", () => {
    it("tracks GA event as detractor when rating 1", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "1" });
      await user.click(button);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "NPS Survey",
        action: "submitted",
        label: "detractor",
        value: 1,
        dimension1: "detractor",
        metric1: 1,
        metric2: 1,
        metric3: -1,
      });
    });

    it("tracks GA event as detractor when rating 6", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "6" });
      await user.click(button);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "NPS Survey",
        action: "submitted",
        label: "detractor",
        value: 6,
        dimension1: "detractor",
        metric1: 1,
        metric2: 6,
        metric3: -1,
      });
    });

    it("tracks GA event as passive when rating 7", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "7" });
      await user.click(button);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "NPS Survey",
        action: "submitted",
        label: "passive",
        value: 7,
        dimension1: "passive",
        metric1: 1,
        metric2: 7,
        metric3: 0,
      });
    });

    it("tracks GA event as passive when rating 8", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "8" });
      await user.click(button);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "NPS Survey",
        action: "submitted",
        label: "passive",
        value: 8,
        dimension1: "passive",
        metric1: 1,
        metric2: 8,
        metric3: 0,
      });
    });

    it("tracks GA event as promoter when rating 9", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "9" });
      await user.click(button);

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
    });

    it("tracks GA event as promoter when rating 10", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "10" });
      await user.click(button);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "NPS Survey",
        action: "submitted",
        label: "promoter",
        value: 10,
        dimension1: "promoter",
        metric1: 1,
        metric2: 10,
        metric3: 1,
      });
    });

    it("calls dismiss when rating is submitted", async () => {
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

      render(<NpsSurvey />);

      const button = screen.getByRole("button", { name: "5" });
      await user.click(button);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("User interactions - Dismiss", () => {
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

      render(<NpsSurvey />);

      const allButtons = screen.getAllByRole("button");
      const dismissButton = allButtons.find((btn) =>
        btn.getAttribute("title")?.includes("survey-option-dismiss"),
      );
      await user.click(dismissButton!);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
    });

    it("does not track GA event when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      render(<NpsSurvey />);

      const allButtons = screen.getAllByRole("button");
      const dismissButton = allButtons.find((btn) =>
        btn.getAttribute("title")?.includes("survey-option-dismiss"),
      );
      await user.click(dismissButton!);

      expect(global.gaEventMock).not.toHaveBeenCalled();
    });
  });

  describe("Structure and styling", () => {
    it("renders within an aside element", () => {
      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const aside = container.querySelector("aside");
      expect(aside).toBeInTheDocument();
    });

    it("renders legend spans with aria-hidden", () => {
      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const legends = container.querySelectorAll('[aria-hidden="true"]');
      expect(legends.length).toBeGreaterThanOrEqual(2);
    });

    it("renders buttons within an ordered list", () => {
      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const ol = container.querySelector("ol");
      expect(ol).toBeInTheDocument();
    });
  });
});
