import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { CustomAliasTip } from "./CustomAliasTip";
import { getRuntimeConfig } from "../../../config";
import { getLocale } from "../../../functions/getLocale";

jest.mock("./CustomAliasTip.module.scss", () => ({}), { virtual: true });

jest.mock("../../../config", () => ({
  getRuntimeConfig: jest.fn(),
}));

jest.mock("../../../functions/getLocale", () => ({
  getLocale: jest.fn(),
}));

describe("CustomAliasTip", () => {
  const mockGetString = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    global.useL10nImpl = () => ({
      getString: mockGetString,
    });

    (getRuntimeConfig as jest.Mock).mockReturnValue({
      mozmailDomain: "mozmail.com",
    });

    (getLocale as jest.Mock).mockReturnValue("en-US");

    mockGetString.mockImplementation((id: string) => {
      switch (id) {
        case "tips-custom-alias-heading-2":
          return "Custom Alias Heading";
        case "tips-custom-alias-content-2":
          return "Custom Alias Content";
        default:
          return id;
      }
    });
  });

  it("renders subdomain when provided", () => {
    render(<CustomAliasTip subdomain="mydomain" />);
    expect(screen.getByText(/@mydomain\.mozmail\.com/)).toBeInTheDocument();
  });

  it("does not render subdomain when not provided", () => {
    render(<CustomAliasTip />);
    expect(screen.queryByText(/@.*\.mozmail\.com/)).not.toBeInTheDocument();
  });

  it("renders heading and content from localization", () => {
    render(<CustomAliasTip />);
    expect(
      screen.getByRole("heading", { name: "Custom Alias Heading" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Custom Alias Content")).toBeInTheDocument();
  });

  it("renders video only when locale is English", () => {
    (getLocale as jest.Mock).mockReturnValue("en-US");
    render(<CustomAliasTip />);

    const video = screen.getByTestId("custom-alias-video") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("aria-hidden", "true");

    expect(video).toHaveAttribute("autoplay");
    expect(video).toHaveAttribute("loop");

    expect(video).toHaveProperty("muted", true);
  });

  it("does not render video when locale is not English", () => {
    (getLocale as jest.Mock).mockReturnValue("fr");
    render(<CustomAliasTip />);

    expect(screen.queryByTestId("custom-alias-video")).not.toBeInTheDocument();
  });
});
