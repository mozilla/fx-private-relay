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

describe("PhoneSurvey", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.gaEventMock.mockClear();
    mockLocalDismissal(false);
    setMockRelayNumberData([getMockRelayNumber()]);
  });

  it("respects visibility conditions", () => {
    const useLocalDismissal = (
      jest.requireMock("../../../hooks/localDismissal.ts") as any
    ).useLocalDismissal;
    const useRelayNumber = (
      jest.requireMock("../../../hooks/api/relayNumber.ts") as any
    ).useRelayNumber;

    const { container: visible } = render(<PhoneSurvey />);
    expect(visible.querySelector("aside")).toBeInTheDocument();
    expect(useLocalDismissal).toHaveBeenCalledWith("phone-survey-2022-11");

    mockLocalDismissal(true);
    const { container: dismissed } = render(<PhoneSurvey />);
    expect(dismissed.firstChild).toBeNull();

    mockLocalDismissal(false);
    useRelayNumber.mockReturnValue({
      error: new Error("Failed"),
      data: undefined,
    });
    const { container: withError } = render(<PhoneSurvey />);
    expect(withError.firstChild).toBeNull();

    useRelayNumber.mockReturnValue({ error: undefined, data: null });
    const { container: nullData } = render(<PhoneSurvey />);
    expect(nullData.firstChild).toBeNull();

    setMockRelayNumberData([]);
    const { container: emptyData } = render(<PhoneSurvey />);
    expect(emptyData.firstChild).toBeNull();

    setMockRelayNumberData([
      getMockRelayNumber({ id: 1 }),
      getMockRelayNumber({ id: 2 }),
    ]);
    const { container: multipleNumbers } = render(<PhoneSurvey />);
    expect(multipleNumbers.querySelector("aside")).toBeInTheDocument();
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
    render(<PhoneSurvey />);

    expect(
      screen.getByText(
        /Answer 4 questions about phone masking to help improve your experience/,
      ),
    ).toBeInTheDocument();

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute(
      "href",
      "https://survey.alchemer.com/s3/7088730/Firefox-Relay-Phone-Masking",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(link);
    expect(global.gaEventMock).toHaveBeenCalledWith({
      category: "Phone launch survey",
      action: "Engage",
      label:
        "Answer 4 questions about phone masking to help improve your experience.",
    });

    global.gaEventMock.mockClear();
    const dismissButton = screen.getByRole("button");
    expect(dismissButton).toHaveAttribute(
      "title",
      expect.stringContaining("survey-option-dismiss"),
    );
    await user.click(dismissButton);
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(global.gaEventMock).not.toHaveBeenCalled();
  });
});
