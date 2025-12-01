import React from "react";
import { render, screen } from "@testing-library/react";
import { LocalizedProps } from "@fluent/react";
import { Localized } from "./Localized";

jest.unmock("./Localized");

const mockUseL10n = jest.fn();
const mockOriginalLocalized = jest.fn();

jest.mock("../hooks/l10n", () => ({
  useL10n: () => mockUseL10n(),
}));

jest.mock("@fluent/react", () => {
  const actual = jest.requireActual("@fluent/react");
  return {
    ...actual,
    Localized: (props: LocalizedProps) => mockOriginalLocalized(props),
  };
});

describe("<Localized>", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseL10n.mockReturnValue({
      getString: (id: string, vars?: Record<string, string>) =>
        `translated: ${id} ${vars ? JSON.stringify(vars) : ""}`,
    });
    mockOriginalLocalized.mockImplementation((props: LocalizedProps) => (
      <div data-testid="fluent-localized">{props.id}</div>
    ));
  });

  it("calls useL10n hook", () => {
    render(<Localized id="test-message-id" />);

    expect(mockUseL10n).toHaveBeenCalled();
  });

  it("renders with Fluent Localized component", () => {
    render(<Localized id="test-message-id" />);

    expect(mockOriginalLocalized).toHaveBeenCalled();
    expect(screen.getByTestId("fluent-localized")).toBeInTheDocument();
  });

  it("passes id prop to the Fluent Localized component", () => {
    render(<Localized id="test-message-id" />);

    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-message-id",
      }),
    );
  });

  it("passes vars prop to the Fluent Localized component", () => {
    const vars = { name: "John", count: "5" };

    render(<Localized id="test-message-id" vars={vars} />);

    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-message-id",
        vars: vars,
      }),
    );
  });

  it("passes element children to the Fluent Localized component", () => {
    render(
      <Localized id="test-message-id">
        <span data-testid="child-element">Placeholder text</span>
      </Localized>,
    );

    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-message-id",
        children: expect.anything(),
      }),
    );
  });

  it("handles rendering without children", () => {
    render(<Localized id="test-message-id" />);

    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-message-id",
      }),
    );
    expect(screen.getByTestId("fluent-localized")).toBeInTheDocument();
  });
});
