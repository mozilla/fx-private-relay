import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DemoPhone } from "./DemoPhone";

jest.mock(
  "./DemoPhone.module.scss",
  () => new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
);

jest.mock("../Image", () => ({
  __esModule: true,
  default: jest.requireActual("../../../__mocks__/components/ImageMock")
    .default,
}));

const getLocaleMock = jest.fn();
jest.mock("../../functions/getLocale", () => ({
  getLocale: (...args: unknown[]) => getLocaleMock(...args),
}));

jest.mock("../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string) => id,
  }),
}));

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
