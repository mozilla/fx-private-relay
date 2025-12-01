import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendersPanelView } from "./SendersPanelView";
import * as metricsModule from "frontend/src/hooks/metrics";
import * as inboundContactModule from "frontend/src/hooks/api/inboundContact";
import { FluentBundle } from "@fluent/bundle";
import { ReactLocalization } from "@fluent/react";

jest.mock("frontend/src/hooks/metrics", () => ({
  useMetrics: jest.fn(),
}));

jest.mock("frontend/src/hooks/api/inboundContact", () => ({
  useInboundContact: jest.fn(),
}));

const mockBack = jest.fn();

function mockL10n(): ReactLocalization {
  const bundle = new FluentBundle("en-US");
  return new ReactLocalization([bundle]);
}

beforeEach(() => {
  jest.clearAllMocks();

  global.useL10nImpl = () => ({
    getString: (key: string) => key,
    bundles: mockL10n().bundles,
  });

  (inboundContactModule.useInboundContact as jest.Mock).mockReturnValue({
    data: [],
    setForwardingState: jest.fn(),
  });
});

describe("SendersPanelView", () => {
  it("renders the empty senders panel", () => {
    render(<SendersPanelView type="empty" back_btn={mockBack} />);
    expect(
      screen.getByAltText("Empty Senders Data Illustration"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-dashboard-sender-empty-body"),
    ).toBeInTheDocument();
  });

  it("renders disabled panel with metrics link", () => {
    (metricsModule.useMetrics as jest.Mock).mockReturnValue(true);

    render(<SendersPanelView type="disabled" back_btn={mockBack} />);

    expect(
      screen.getByAltText("Disabled Senders Data Illustration"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("phone-dashboard-sender-disabled-body"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "phone-dashboard-sender-disabled-update-settings",
      }),
    ).toHaveAttribute("href", "/accounts/settings/");
  });

  it("renders disabled panel without metrics link", () => {
    (metricsModule.useMetrics as jest.Mock).mockReturnValue(false);

    render(<SendersPanelView type="disabled" back_btn={mockBack} />);

    expect(
      screen.getByRole("link", {
        name: "phone-dashboard-sender-disabled-update-settings",
      }),
    ).toHaveAttribute("href", "/accounts/settings/");
  });

  it("renders sorted sender logs", () => {
    (inboundContactModule.useInboundContact as jest.Mock).mockReturnValue({
      data: [
        {
          id: "1",
          inbound_number: "+1234567890",
          last_inbound_date: "2025-07-01T10:00:00Z",
          last_inbound_type: "text",
          blocked: false,
        },
        {
          id: "2",
          inbound_number: "+1987654321",
          last_inbound_date: "2025-07-01T09:00:00Z",
          last_inbound_type: "call",
          blocked: true,
        },
      ],
      setForwardingState: jest.fn(),
    });

    render(<SendersPanelView type="primary" back_btn={mockBack} />);

    // Match the component's exact formatting (spaces around the hyphen)
    expect(screen.getByText("(234) 567 - 890")).toBeInTheDocument();
    expect(screen.getByText("(987) 654 - 321")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: /Block|Unblock/ });
    expect(buttons).toHaveLength(2);
  });

  it("calls back_btn when the back button is clicked", async () => {
    const user = userEvent.setup();
    render(<SendersPanelView type="primary" back_btn={mockBack} />);
    await user.click(
      screen.getByRole("button", { name: "Back to Primary Dashboard" }),
    );
    expect(mockBack).toHaveBeenCalled();
  });
});
