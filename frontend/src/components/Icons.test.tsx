import { render, screen } from "@testing-library/react";

// Import the actual Icons module, not the mock
const IconsModule = jest.requireActual("./Icons");
const InfoIcon = IconsModule.InfoIcon;
const WarningFilledIcon = IconsModule.WarningFilledIcon;
const ArrowDownIcon = IconsModule.ArrowDownIcon;
const CheckIcon = IconsModule.CheckIcon;
const CloseIcon = IconsModule.CloseIcon;
const CopyIcon = IconsModule.CopyIcon;
const InfoFilledIcon = IconsModule.InfoFilledIcon;
const InfoBulbIcon = IconsModule.InfoBulbIcon;
const InfoTriangleIcon = IconsModule.InfoTriangleIcon;
const LockIcon = IconsModule.LockIcon;
const SearchIcon = IconsModule.SearchIcon;
const PlusIcon = IconsModule.PlusIcon;
const CheckCircleIcon = IconsModule.CheckCircleIcon;
const StarIcon = IconsModule.StarIcon;
const PhoneIcon = IconsModule.PhoneIcon;
const VpnIcon = IconsModule.VpnIcon;
const MaskIcon = IconsModule.MaskIcon;

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

  describe("InfoFilledIcon", () => {
    it("renders with alt text", () => {
      render(<InfoFilledIcon alt="Information" />);
      const icon = screen.getByRole("img", { name: "Information" });
      expect(icon).toBeInTheDocument();
    });

    it("is hidden from screen readers when alt is empty", () => {
      const { container } = render(<InfoFilledIcon alt="" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("InfoBulbIcon", () => {
    it("renders with alt text", () => {
      render(<InfoBulbIcon alt="Tip" />);
      const icon = screen.getByRole("img", { name: "Tip" });
      expect(icon).toBeInTheDocument();
    });

    it("has proper dimensions", () => {
      const { container } = render(<InfoBulbIcon alt="Tip" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("width", "24");
      expect(svg).toHaveAttribute("height", "24");
    });
  });

  describe("InfoTriangleIcon", () => {
    it("renders with alt text", () => {
      render(<InfoTriangleIcon alt="Alert" />);
      const icon = screen.getByRole("img", { name: "Alert" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("LockIcon", () => {
    it("renders with alt text", () => {
      render(<LockIcon alt="Locked" />);
      const icon = screen.getByRole("img", { name: "Locked" });
      expect(icon).toBeInTheDocument();
    });

    it("includes title element", () => {
      const { container } = render(<LockIcon alt="Secure" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const title = container.querySelector("title");
      expect(title).toHaveTextContent("Secure");
    });
  });

  describe("SearchIcon", () => {
    it("renders with alt text", () => {
      render(<SearchIcon alt="Search" />);
      const icon = screen.getByRole("img", { name: "Search" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("PlusIcon", () => {
    it("renders with alt text", () => {
      render(<PlusIcon alt="Add" />);
      const icon = screen.getByRole("img", { name: "Add" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("CheckCircleIcon", () => {
    it("renders with alt text", () => {
      render(<CheckCircleIcon alt="Verified" />);
      const icon = screen.getByRole("img", { name: "Verified" });
      expect(icon).toBeInTheDocument();
    });

    it("is hidden from screen readers when alt is empty", () => {
      const { container } = render(<CheckCircleIcon alt="" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("StarIcon", () => {
    it("renders with alt text", () => {
      render(<StarIcon alt="Favorite" />);
      const icon = screen.getByRole("img", { name: "Favorite" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("PhoneIcon", () => {
    it("renders with alt text", () => {
      render(<PhoneIcon alt="Phone" />);
      const icon = screen.getByRole("img", { name: "Phone" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("VpnIcon", () => {
    it("renders with alt text", () => {
      render(<VpnIcon alt="VPN" />);
      const icon = screen.getByRole("img", { name: "VPN" });
      expect(icon).toBeInTheDocument();
    });
  });

  describe("MaskIcon", () => {
    it("renders with alt text", () => {
      render(<MaskIcon alt="Mask" />);
      const icon = screen.getByRole("img", { name: "Mask" });
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
      expect(svg?.getAttribute("class")).toContain("custom-class");
    });

    it("applies aria-label correctly when alt is provided", () => {
      const { container } = render(<CheckIcon alt="Completed" />);
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("aria-label", "Completed");
      expect(svg).toHaveAttribute("role", "img");
    });

    it("sets aria-hidden to true when alt is empty string", () => {
      const { container: closeContainer } = render(<CloseIcon alt="" />);
      const { container: copyContainer } = render(<CopyIcon alt="" />);

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const closeSvg = closeContainer.querySelector("svg");
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const copySvg = copyContainer.querySelector("svg");

      expect(closeSvg).toHaveAttribute("aria-hidden", "true");
      expect(copySvg).toHaveAttribute("aria-hidden", "true");
    });

    it("multiple icons can be rendered simultaneously", () => {
      render(
        <>
          <InfoIcon alt="Info 1" />
          <WarningFilledIcon alt="Warning 1" />
          <CheckIcon alt="Check 1" />
        </>,
      );

      expect(screen.getByRole("img", { name: "Info 1" })).toBeInTheDocument();
      expect(
        screen.getByRole("img", { name: "Warning 1" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "Check 1" })).toBeInTheDocument();
    });

    it("handles custom width and height props", () => {
      const { container } = render(
        <SearchIcon alt="Search" width={32} height={32} />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("width", "32");
      expect(svg).toHaveAttribute("height", "32");
    });

    it("preserves additional SVG props like style", () => {
      const { container } = render(
        <PlusIcon alt="Add" style={{ color: "red", opacity: 0.5 }} />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveStyle({ opacity: 0.5 });
      expect(svg).toHaveAttribute("style");
    });

    it("handles onClick handlers", () => {
      const handleClick = jest.fn();
      const { container } = render(
        <CloseIcon alt="Close" onClick={handleClick} />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      svg?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("supports data attributes", () => {
      const { container } = render(
        <LockIcon alt="Locked" data-feature="security" data-status="active" />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("data-feature", "security");
      expect(svg).toHaveAttribute("data-status", "active");
    });

    it("maintains viewBox attribute when custom dimensions are provided", () => {
      const { container } = render(
        <InfoIcon alt="Info" width={50} height={50} />,
      );
      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
      const svg = container.querySelector("svg");

      expect(svg).toHaveAttribute("viewBox", "0 0 28 28");
      expect(svg).toHaveAttribute("width", "50");
      expect(svg).toHaveAttribute("height", "50");
    });
  });
});
