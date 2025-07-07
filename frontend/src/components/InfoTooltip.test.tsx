import { render, screen } from "@testing-library/react";
import { InfoTooltip } from "./InfoTooltip";

jest.mock("react-stately", () => {
  const actual = jest.requireActual("react-stately");
  return {
    ...actual,
    useTooltipTriggerState: jest.fn(() => ({
      isOpen: true,
      open: jest.fn(),
      close: jest.fn(),
      toggle: jest.fn(),
    })),
  };
});

describe("InfoTooltip (with mocked state)", () => {
  const alt = "Information";
  const iconColor = "#000";
  const tooltipText = "This is a tooltip";

  function renderTooltip() {
    render(
      <InfoTooltip alt={alt} iconColor={iconColor}>
        {tooltipText}
      </InfoTooltip>,
    );
  }

  test("renders the info icon with correct props", () => {
    renderTooltip();

    const icon = screen.getByLabelText(alt);
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute("width", "18");
    expect(icon).toHaveAttribute("height", "18");
  });

  test("renders the tooltip content when open", () => {
    renderTooltip();

    const tooltip = screen.getByText(tooltipText);
    expect(tooltip).toBeInTheDocument();
    expect(tooltip).toBeVisible();
    expect(tooltip).toHaveClass("tooltip");
  });

  test("renders both trigger and tooltip with expected classNames", () => {
    renderTooltip();

    const trigger = screen.getByTestId("trigger");
    expect(trigger).toHaveClass("trigger");

    const tooltip = screen.getByText(tooltipText);
    expect(tooltip).toHaveClass("tooltip");
  });
});
