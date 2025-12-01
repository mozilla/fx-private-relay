import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DemoPhone } from "./DemoPhone";

jest.mock(
  "./DemoPhone.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

// Image imports are mocked globally in __mocks__/components/landingImages.mocks.ts
// The mocked values are:
// - background: "/bg.svg"
// - premium (en): "/premium.svg"
// - premium (fr): "/premium-fr.svg"
// - premium (de): "/premium-de.svg"
// - nopremium: "/nopremium.svg"
// - foreground (en): "/fg.svg"
// - foreground (de): "/fg-de.svg"
// - foreground (fr): "/fg-fr.svg"

function setup({ premium, locale }: { premium?: boolean; locale: string }) {
  getLocaleMock.mockReturnValue(locale);
  render(<DemoPhone premium={premium} />);
  const allImages = screen.getAllByTestId("mocked-image") as HTMLImageElement[];
  return { allImages };
}

describe("DemoPhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("always renders the background image", () => {
    const { allImages } = setup({ locale: "en-US", premium: true });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
  });

  it("uses French premium screenshot and French foreground for fr-FR locale", () => {
    const { allImages } = setup({ locale: "fr-FR", premium: true });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
    expect(allImages[1]).toHaveAttribute("src", "/premium-fr.svg");
    expect(allImages[2]).toHaveAttribute("src", "/fg-fr.svg");
  });

  it("uses German premium screenshot and German foreground for de-DE locale", () => {
    const { allImages } = setup({ locale: "de-DE", premium: true });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
    expect(allImages[1]).toHaveAttribute("src", "/premium-de.svg");
    expect(allImages[2]).toHaveAttribute("src", "/fg-de.svg");
  });

  it("uses English premium screenshot and English foreground for en-US locale", () => {
    const { allImages } = setup({ locale: "en-US", premium: true });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
    expect(allImages[1]).toHaveAttribute("src", "/premium.svg");
    expect(allImages[2]).toHaveAttribute("src", "/fg.svg");
  });

  it("uses no-premium screenshot and English foreground when premium is not available", () => {
    const { allImages } = setup({ locale: "en-US", premium: false });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
    expect(allImages[1]).toHaveAttribute("src", "/nopremium.svg");
    expect(allImages[2]).toHaveAttribute("src", "/fg.svg");
  });

  it("falls back to English images for unsupported locales", () => {
    const { allImages } = setup({ locale: "es-ES", premium: true });
    expect(allImages).toHaveLength(3);
    expect(allImages[0]).toHaveAttribute("src", "/bg.svg");
    expect(allImages[1]).toHaveAttribute("src", "/premium.svg");
    expect(allImages[2]).toHaveAttribute("src", "/fg.svg");
  });
});
