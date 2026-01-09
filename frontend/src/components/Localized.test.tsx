import React from "react";
import { render, screen } from "@testing-library/react";
import { LocalizedProps } from "@fluent/react";
import { Localized } from "./Localized";

jest.unmock("./Localized");

const mockOriginalLocalized = jest.fn();

jest.mock("../hooks/l10n", () => {
  const { mockUseL10nModule } = jest.requireActual(
    "../../__mocks__/hooks/l10n",
  );
  return mockUseL10nModule;
});

jest.mock("@fluent/react", () => {
  const actual = jest.requireActual("@fluent/react");
  return {
    ...actual,
    Localized: (props: LocalizedProps) => mockOriginalLocalized(props),
  };
});

describe("Localized", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOriginalLocalized.mockImplementation((props: LocalizedProps) => (
      <div data-testid="fluent-localized">{props.id}</div>
    ));
  });

  it("calls useL10n and renders with Fluent Localized component", () => {
    render(<Localized id="test-message-id" />);

    expect(mockOriginalLocalized).toHaveBeenCalled();
    expect(screen.getByTestId("fluent-localized")).toBeInTheDocument();
  });

  it("passes all props correctly to Fluent Localized", () => {
    render(<Localized id="basic-id" />);
    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({ id: "basic-id" }),
    );

    const vars = { name: "John", count: "5" };
    render(<Localized id="with-vars" vars={vars} />);
    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({ id: "with-vars", vars }),
    );

    render(
      <Localized id="with-children">
        <span data-testid="child-element">Placeholder text</span>
      </Localized>,
    );
    expect(mockOriginalLocalized).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "with-children",
        children: expect.anything(),
      }),
    );
  });
});
