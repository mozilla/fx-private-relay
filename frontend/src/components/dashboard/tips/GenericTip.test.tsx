import { render, screen, within } from "@testing-library/react";
import { GenericTip, GenericTipProps } from "./GenericTip";
import { getLocale } from "../../../functions/getLocale";
import React from "react";

jest.mock("./GenericTip.module.scss", () => ({
  "generic-tip": "generic-tip",
  "still-alternative": "still-alternative",
}));

jest.mock("../../Image", () => {
  const MockImage: React.FC<{
    className?: string;
    src: string | { src: string };
    alt?: string;
  }> = ({ className, src, alt }) => (
    <img
      data-testid="mock-image"
      className={className}
      src={typeof src === "string" ? src : src?.src}
      alt={alt ?? ""}
    />
  );
  return { __esModule: true, default: MockImage };
});

jest.mock("../../../functions/getLocale", () => ({
  getLocale: jest.fn(),
}));

describe("GenericTip", () => {
  const mockL10n = {};
  const baseProps: GenericTipProps = {
    title: "Test Tip Title",
    content: <p>Some test tip content</p>,
    videos: { "video/mp4": "video.mp4", "video/webm": "video.webm" },
    image: {
      src: "test-image.png",
    } as unknown as import("next/image").StaticImageData,
    alt: "Alt text",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.useL10nImpl = () => mockL10n;
    // default to a non-English locale
    (getLocale as jest.Mock).mockReturnValue("fr");
  });

  it("renders title and content", () => {
    render(<GenericTip {...baseProps} />);
    expect(screen.getByText("Test Tip Title")).toBeInTheDocument();
    expect(screen.getByText("Some test tip content")).toBeInTheDocument();
  });

  it("renders video and the still image when locale is English and videos provided", () => {
    (getLocale as jest.Mock).mockReturnValue("en-US");
    render(<GenericTip {...baseProps} />);
    const video = screen.getByTitle("Alt text");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("poster", "test-image.png");
    const imgsByAlt = screen.getAllByRole("img", { name: "Alt text" });
    const stillAlt = imgsByAlt.find((el) =>
      el.classList.contains("still-alternative"),
    );
    expect(stillAlt).toBeTruthy();
  });

  it("falls back to an <img> inside <video> when image is a string", () => {
    (getLocale as jest.Mock).mockReturnValue("en-US");
    // @ts-expect-error: testing runtime-supported string image fallback
    render(<GenericTip {...baseProps} image="fallback-image.png" />);
    const video = screen.getByTitle("Alt text");
    expect(video).toBeInTheDocument();
    const imgInsideVideo = within(video).getByTestId("mock-image");
    expect(imgInsideVideo).toHaveAttribute("src", "fallback-image.png");
    const imgsByAlt = screen.getAllByRole("img", { name: "Alt text" });
    const stillAlt = imgsByAlt.find((el) =>
      el.classList.contains("still-alternative"),
    );
    expect(stillAlt).toBeTruthy();
  });

  it("does not render video when locale is not English", () => {
    render(<GenericTip {...baseProps} />);
    expect(screen.queryByTitle("Alt text")).not.toBeInTheDocument();
  });

  it("does not render video when videos prop is missing", () => {
    (getLocale as jest.Mock).mockReturnValue("en-US");
    render(<GenericTip {...baseProps} videos={undefined} />);
    expect(screen.queryByTitle("Alt text")).not.toBeInTheDocument();
  });
});
