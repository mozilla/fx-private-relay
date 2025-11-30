import { render, screen } from "@testing-library/react";

// Import the actual Icons module, not the mock
const IconsModule = jest.requireActual("./Icons");
const InfoIcon = IconsModule.InfoIcon;
const WarningFilledIcon = IconsModule.WarningFilledIcon;
const ArrowDownIcon = IconsModule.ArrowDownIcon;
const CheckIcon = IconsModule.CheckIcon;
const CloseIcon = IconsModule.CloseIcon;
const CopyIcon = IconsModule.CopyIcon;

describe("Icons", () => {
  describe("InfoIcon", () => {
    it("renders with alt text", () => {
      render(<InfoIcon alt="Information" />);
      const icon = screen.getByRole("img", { name: "Information" });
      expect(icon).toBeInTheDocument();
    });

    it("is hidden from screen readers when alt is empty", () => {
      const { container } = render(<InfoIcon alt="" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });

    it("has proper viewBox and dimensions", () => {
      const { container } = render(<InfoIcon alt="Info" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("viewBox", "0 0 28 28");
      expect(svg).toHaveAttribute("width", "28");
      expect(svg).toHaveAttribute("height", "28");
    });
  });

  describe("WarningFilledIcon", () => {
    it("renders with alt text", () => {
      render(<WarningFilledIcon alt="Warning" />);
      const icon = screen.getByRole("img", { name: "Warning" });
      expect(icon).toBeInTheDocument();
    });

    it("is hidden from screen readers when alt is empty", () => {
      const { container } = render(<WarningFilledIcon alt="" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("ArrowDownIcon", () => {
    it("renders with alt text", () => {
      render(<ArrowDownIcon alt="Expand" />);
      const icon = screen.getByRole("img", { name: "Expand" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("CheckIcon", () => {
    it("renders with alt text", () => {
      render(<CheckIcon alt="Success" />);
      const icon = screen.getByRole("img", { name: "Success" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("CloseIcon", () => {
    it("renders with alt text", () => {
      render(<CloseIcon alt="Close" />);
      const icon = screen.getByRole("img", { name: "Close" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("CopyIcon", () => {
    it("renders with alt text", () => {
      render(<CopyIcon alt="Copy" />);
      const icon = screen.getByRole("img", { name: "Copy" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("Icon accessibility", () => {
    it("all icons include title element for accessibility", () => {
      const { container: infoContainer } = render(<InfoIcon alt="Info" />);
      const { container: warningContainer } = render(
        <WarningFilledIcon alt="Warning" />,
      );

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const infoTitle = infoContainer.querySelector("title");
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const warningTitle = warningContainer.querySelector("title");

      expect(infoTitle).toHaveTextContent("Info");
      expect(warningTitle).toHaveTextContent("Warning");
    });

    it("passes custom props to svg element", () => {
      const { container } = render(
        <InfoIcon
          alt="Info"
          data-testid="custom-icon"
          className="custom-class"
        />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("data-testid", "custom-icon");
      // Check if className baseVal contains the custom class
      expect(svg?.getAttribute("class")).toContain("custom-class");
    });
  });
});
