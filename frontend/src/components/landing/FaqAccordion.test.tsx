import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { FaqAccordionItem } from "./FaqAccordion";

jest.mock("./FaqAccordion.module.scss", () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
}));

function setup(ui: React.ReactElement) {
  const user = userEvent.setup();
  const utils = render(ui);
  return { user, ...utils };
}

const entries = [
  { q: "Question 1", a: <span>Answer 1</span> },
  { q: "Question 2", a: <span>Answer 2</span> },
  { q: "Question 3", a: <span>Answer 3</span> },
];

describe("FaqAccordionItem", () => {
  it("renders all entries", () => {
    setup(<FaqAccordionItem entries={entries} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(screen.getByText("Answer 1")).toBeInTheDocument();
    expect(screen.getByText("Answer 2")).toBeInTheDocument();
    expect(screen.getByText("Answer 3")).toBeInTheDocument();
    expect(screen.getAllByTestId("svg-icon")).toHaveLength(3);
  });

  it("focuses the first item by default when autoFocus is enabled", () => {
    setup(<FaqAccordionItem entries={entries} autoFocus />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveFocus();
  });

  it("respects defaultExpandedIndex for initial focus when autoFocus is enabled", () => {
    setup(
      <FaqAccordionItem entries={entries} autoFocus defaultExpandedIndex={1} />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toHaveFocus();
  });

  it("moves focus to the clicked item when autoFocus is enabled", async () => {
    const { user } = setup(<FaqAccordionItem entries={entries} autoFocus />);
    const buttons = screen.getAllByRole("button");
    await user.click(buttons[2]);
    expect(buttons[2]).toHaveFocus();
    await user.click(buttons[1]);
    expect(buttons[1]).toHaveFocus();
  });
});
