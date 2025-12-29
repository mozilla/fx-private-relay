import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import {
  getMockRelayNumber,
  setMockRelayNumberData,
} from "../../../../__mocks__/hooks/api/relayNumber";
import { mockLocalDismissal } from "../../../../__mocks__/testHelpers";
import { PhoneSurvey } from "./PhoneSurvey";

jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../hooks/gaEvent.ts");
jest.mock("../../../hooks/gaViewPing.ts", () => ({
  useGaViewPing: () => ({ current: null }),
}));
jest.mock("../../../hooks/localDismissal.ts");
jest.mock("../../../hooks/api/relayNumber.ts");

describe("<PhoneSurvey>", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();

    mockLocalDismissal(false);
    setMockRelayNumberData([getMockRelayNumber()]);
  });

  describe("Visibility conditions", () => {
    it("renders when not dismissed and user has relay number", () => {
      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).not.toBeNull();
    });

    it("does not render when dismissed", () => {
      mockLocalDismissal(true);

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when relay number data has an error", () => {
      setMockRelayNumberData([], {
        registerRelayNumber: jest.fn(),
        setForwardingState: jest.fn(),
      });

      const useRelayNumber =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/api/relayNumber.ts") as any)
          .useRelayNumber;
      useRelayNumber.mockReturnValue({
        error: new Error("Failed to fetch"),
        data: undefined,
      });

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when relay number data is not an array", () => {
      const useRelayNumber =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/api/relayNumber.ts") as any)
          .useRelayNumber;
      useRelayNumber.mockReturnValue({
        error: undefined,
        data: null,
      });

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("does not render when relay number data is an empty array", () => {
      setMockRelayNumberData([]);

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).toBeNull();
    });

    it("uses correct dismissal key", () => {
      const useLocalDismissal =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/localDismissal.ts") as any)
          .useLocalDismissal;

      render(<PhoneSurvey />);

      expect(useLocalDismissal).toHaveBeenCalledWith("phone-survey-2022-11");
    });
  });

  describe("Content rendering", () => {
    it("renders the survey message", () => {
      render(<PhoneSurvey />);

      const message = screen.getByText(
        /Answer 4 questions about phone masking to help improve your experience/,
      );
      expect(message).toBeInTheDocument();
    });

    it("renders survey link with correct href", () => {
      render(<PhoneSurvey />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute(
        "href",
        "https://survey.alchemer.com/s3/7088730/Firefox-Relay-Phone-Masking",
      );
    });

    it("renders survey link with target blank", () => {
      render(<PhoneSurvey />);

      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("renders dismiss button", () => {
      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toBeInTheDocument();
    });

    it("renders CloseIcon in dismiss button", () => {
      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toHaveAttribute(
        "title",
        expect.stringContaining("survey-option-dismiss"),
      );
    });
  });

  describe("User interactions", () => {
    it("tracks GA event when survey link is clicked", async () => {
      const user = userEvent.setup();
      render(<PhoneSurvey />);

      const link = screen.getByRole("link");
      await user.click(link);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "Phone launch survey",
        action: "Engage",
        label:
          "Answer 4 questions about phone masking to help improve your experience.",
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

      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      await user.click(dismissButton);

      expect(mockDismiss).toHaveBeenCalledTimes(1);
      expect(mockDismiss).toHaveBeenCalledWith();
    });

    it("does not track GA event when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      await user.click(dismissButton);

      expect(global.gaEventMock).not.toHaveBeenCalled();
    });
  });

  describe("Localization", () => {
    it("uses localized dismiss button text", () => {
      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      expect(dismissButton).toHaveAttribute("title");
    });

    it("passes correct l10n string to CloseIcon", () => {
      render(<PhoneSurvey />);

      const dismissButton = screen.getByRole("button");
      const title = dismissButton.getAttribute("title");
      expect(title).toContain("survey-option-dismiss");
    });
  });

  describe("Structure and styling", () => {
    it("renders within an aside element", () => {
      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const aside = container.querySelector("aside");
      expect(aside).toBeInTheDocument();
    });

    it("renders survey link as the main content", () => {
      render(<PhoneSurvey />);

      const link = screen.getByRole("link");
      expect(link).toHaveTextContent(
        "Answer 4 questions about phone masking to help improve your experience.",
      );
    });
  });

  describe("Relay number integration", () => {
    it("renders when user has one relay number", () => {
      setMockRelayNumberData([getMockRelayNumber()]);

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).not.toBeNull();
    });

    it("renders when user has multiple relay numbers", () => {
      setMockRelayNumberData([
        getMockRelayNumber({ id: 1 }),
        getMockRelayNumber({ id: 2 }),
      ]);

      const { container } = render(<PhoneSurvey />);

      // eslint-disable-next-line testing-library/no-node-access, jest-dom/prefer-empty
      expect(container.firstChild).not.toBeNull();
    });

    it("calls useRelayNumber hook", () => {
      const useRelayNumber =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/api/relayNumber.ts") as any)
          .useRelayNumber;

      render(<PhoneSurvey />);

      expect(useRelayNumber).toHaveBeenCalled();
    });
  });
});
