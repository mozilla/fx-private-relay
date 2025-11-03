// BundleBanner
jest.mock(
  "../../src/components/landing/images/bundle-banner-woman-400w.png",
  () => ({ __esModule: true, default: "/img400.png" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/bundle-banner-woman-768w.png",
  () => ({ __esModule: true, default: "/img768.png" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/bundle-float-1.svg",
  () => ({ __esModule: true, default: "/float1.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/bundle-float-2.svg",
  () => ({ __esModule: true, default: "/float2.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/bundle-float-3.svg",
  () => ({ __esModule: true, default: "/float3.svg" }),
  { virtual: true },
);

// HighlightedFeatures
jest.mock(
  "../../src/components/landing/images/highlighted-features/features-unlimited-email-masks.svg",
  () => ({ __esModule: true, default: "/unlimited.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/highlighted-features/features-instantly-masks-on-the-go.svg",
  () => ({ __esModule: true, default: "/on-the-go.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/highlighted-features/features-reply-to-emails-anon.svg",
  () => ({ __esModule: true, default: "/reply.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/highlighted-features/features-block-promotional-emails.svg",
  () => ({ __esModule: true, default: "/block.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/highlighted-features/features-remove-email-trackers.svg",
  () => ({ __esModule: true, default: "/remove.svg" }),
  { virtual: true },
);

// DemoPhone
jest.mock(
  "../../src/components/landing/images/hero-image-bg.svg",
  () => ({ __esModule: true, default: "/bg.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-premium.svg",
  () => ({ __esModule: true, default: "/premium.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-premium-fr.svg",
  () => ({ __esModule: true, default: "/premium-fr.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-premium-de.svg",
  () => ({ __esModule: true, default: "/premium-de.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-nopremium.svg",
  () => ({ __esModule: true, default: "/nopremium.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-fg.svg",
  () => ({ __esModule: true, default: "/fg.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-fg-de.svg",
  () => ({ __esModule: true, default: "/fg-de.svg" }),
  { virtual: true },
);
jest.mock(
  "../../src/components/landing/images/hero-image-fg-fr.svg",
  () => ({ __esModule: true, default: "/fg-fr.svg" }),
  { virtual: true },
);

// Reviews
jest.mock(
  "../../src/components/landing/images/fx-logo.svg",
  () => ({ __esModule: true, default: "/fx-logo.svg" }),
  { virtual: true },
);
