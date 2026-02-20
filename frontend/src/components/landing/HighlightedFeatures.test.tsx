import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { HighlightedFeatures } from "./HighlightedFeatures";

jest.mock("./HighlightedFeatures.module.scss", () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
}));

describe("HighlightedFeatures", () => {
  it("renders section titles and CTA", () => {
    render(<HighlightedFeatures />);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "l10n string: [highlighted-features-section-title], with vars: {}",
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "l10n string: [highlighted-features-section-bottom-title], with vars: {}",
      }),
    ).toBeInTheDocument();

    const cta = screen.getByRole("link", {
      name: "l10n string: [highlighted-features-section-bottom-cta], with vars: {}",
    });
    expect(cta).toHaveAttribute("href", "#pricing");
  });

  it("renders all highlighted items with headline and body", () => {
    render(<HighlightedFeatures />);
    const names = [
      "unlimited-masks",
      "masks-on-the-go",
      "replying",
      "block-promotions",
      "remove-trackers",
    ];

    for (const n of names) {
      expect(
        screen.getByText(
          `l10n string: [highlighted-features-section-${n}-headline], with vars: {}`,
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `l10n string: [highlighted-features-section-${n}-body-2], with vars: {"mask_limit":"5","mozmail":"mozmail.com"}`,
        ),
      ).toBeInTheDocument();
    }
  });

  it("renders five feature images", () => {
    render(<HighlightedFeatures />);
    const imgs = screen.getAllByAltText("");
    expect(imgs).toHaveLength(5);
  });
});
