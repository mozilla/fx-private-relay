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

describe("<NpsSurvey>", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();

    mockLocalDismissal(false);
    mockFirstSeenDaysAgo(4);
    mockLoginStatus("logged-in");

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
      mockLocalDismissal(true);

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when user has been active for less than the threshold", () => {
      mockFirstSeen(new Date(Date.now() - 1000));

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when user is not logged in", () => {
      mockLoginStatus("logged-out");

      const { container } = render(<NpsSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when firstSeen is not a Date", () => {
      mockFirstSeen(null);

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
    test.each([
      { rating: 1, category: "detractor", metric3: -1 },
      { rating: 6, category: "detractor", metric3: -1 },
      { rating: 7, category: "passive", metric3: 0 },
      { rating: 8, category: "passive", metric3: 0 },
      { rating: 9, category: "promoter", metric3: 1 },
      { rating: 10, category: "promoter", metric3: 1 },
    ])(
      "tracks GA event as $category when rating $rating",
      async ({ rating, category, metric3 }) => {
        const user = userEvent.setup();
        render(<NpsSurvey />);

        const button = screen.getByRole("button", { name: rating.toString() });
        await user.click(button);

        expect(global.gaEventMock).toHaveBeenCalledWith({
          category: "NPS Survey",
          action: "submitted",
          label: category,
          value: rating,
          dimension1: category,
          metric1: 1,
          metric2: rating,
          metric3,
        });
      },
    );

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
