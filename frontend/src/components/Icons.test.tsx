import { render, screen } from "@testing-library/react";

const IconsModule = jest.requireActual("./Icons");
const { InfoIcon, CheckIcon, CloseIcon, LockIcon, SearchIcon } = IconsModule;

describe("Icons", () => {
  it("renders icons with correct attributes and accessibility", () => {
    const { container: infoContainer } = render(<InfoIcon alt="Information" />);
    expect(
      screen.getByRole("img", { name: "Information" }),
    ).toBeInTheDocument();
    const infoSvg = infoContainer.querySelector("svg");
    expect(infoSvg).toHaveAttribute("viewBox", "0 0 28 28");
    expect(infoSvg).toHaveAttribute("width", "28");
    expect(infoSvg).toHaveAttribute("height", "28");
    expect(infoSvg).toHaveAttribute("aria-label", "Information");
    expect(infoSvg).toHaveAttribute("role", "img");
    expect(infoContainer.querySelector("title")).toHaveTextContent(
      "Information",
    );

    const { container: checkContainer } = render(<CheckIcon alt="Success" />);
    expect(screen.getByRole("img", { name: "Success" })).toBeInTheDocument();

    const { container: lockContainer } = render(<LockIcon alt="Locked" />);
    expect(screen.getByRole("img", { name: "Locked" })).toBeInTheDocument();
    expect(lockContainer.querySelector("title")).toHaveTextContent("Locked");

    render(
      <>
        <CloseIcon alt="Close 1" />
        <SearchIcon alt="Search 1" />
      </>,
    );
    expect(screen.getByRole("img", { name: "Close 1" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Search 1" })).toBeInTheDocument();
  });

  it("handles empty alt text and aria-hidden", () => {
    const { container: emptyAlt1 } = render(<InfoIcon alt="" />);
    const { container: emptyAlt2 } = render(<CloseIcon alt="" />);

    expect(emptyAlt1.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(emptyAlt2.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("supports custom props and dimensions", () => {
    const handleClick = jest.fn();
    const { container } = render(
      <InfoIcon
        alt="Custom"
        width={50}
        height={50}
        className="custom-class"
        data-testid="custom-icon"
        data-feature="security"
        style={{ opacity: 0.5 }}
        onClick={handleClick}
      />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("viewBox", "0 0 28 28");
    expect(svg).toHaveAttribute("width", "50");
    expect(svg).toHaveAttribute("height", "50");
    expect(svg).toHaveAttribute("data-testid", "custom-icon");
    expect(svg).toHaveAttribute("data-feature", "security");
    expect(svg?.getAttribute("class")).toContain("custom-class");
    expect(svg).toHaveStyle({ opacity: 0.5 });

    svg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
