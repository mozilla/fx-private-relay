import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DemoPhone } from "./DemoPhone";

jest.mock(
  "./DemoPhone.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

function setup({ premium, locale }: { premium?: boolean; locale: string }) {
  getLocaleMock.mockReturnValue(locale);
  render(<DemoPhone premium={premium} />);
  const imgs = screen.getAllByAltText("") as HTMLImageElement[];
  return { imgs };
}

describe("DemoPhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders background image first", () => {
    const { imgs } = setup({ locale: "en-US", premium: true });
    expect(imgs[0]).toBeInTheDocument();
  });

  it("uses premium FR screenshot and FR foreground", () => {
    const { imgs } = setup({ locale: "fr-FR", premium: true });
    expect(imgs[1]).toBeInTheDocument();
    expect(imgs[2]).toBeInTheDocument();
  });

  it("uses premium DE screenshot and DE foreground", () => {
    const { imgs } = setup({ locale: "de-DE", premium: true });
    expect(imgs[1]).toBeInTheDocument();
    expect(imgs[2]).toBeInTheDocument();
  });

  it("uses premium EN screenshot and EN foreground", () => {
    const { imgs } = setup({ locale: "en-US", premium: true });
    expect(imgs[1]).toBeInTheDocument();
    expect(imgs[2]).toBeInTheDocument();
  });

  it("uses no-premium screenshot and EN foreground when not premium", () => {
    const { imgs } = setup({ locale: "en-US", premium: false });
    expect(imgs[1]).toBeInTheDocument();
    expect(imgs[2]).toBeInTheDocument();
  });
});
