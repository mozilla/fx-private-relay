import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { Reviews } from "./Reviews";

import "../../../__mocks__/components/landingImages.mocks";

jest.mock("./Reviews.module.scss", () => ({
  __esModule: true,
  default: new Proxy({}, { get: (_: unknown, p: PropertyKey) => String(p) }),
}));

jest.mock("../Image", () => ({
  __esModule: true,
  default: jest.requireActual("../../../__mocks__/components/ImageMock")
    .default,
}));
jest.mock("../Icons", () =>
  jest.requireActual("../../../__mocks__/components/IconsMock"),
);

jest.mock("../../hooks/l10n", () => ({
  useL10n: () => ({
    getString: (id: string, vars?: Record<string, unknown>) =>
      `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,
  }),
}));

const getLocaleMock = jest.fn();
jest.mock("../../functions/getLocale", () => ({
  getLocale: (...args: unknown[]) => getLocaleMock(...args),
}));

jest.mock("react-aria", () => ({
  useButton: (opts: { onPress?: () => void }) => ({
    buttonProps: { onClick: opts.onPress },
  }),
}));

function setup(locale = "en-US") {
  getLocaleMock.mockReturnValue(locale);
  const user = userEvent.setup();
  render(<Reviews />);
  return { user };
}

describe("Reviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Firefox logo block and aggregate rating info", () => {
    setup();
    // The logo has alt="", so it won't have role="img"
    const logoImg = screen.getAllByAltText("")[0] as HTMLImageElement;
    expect(logoImg).toBeInTheDocument();
    expect(logoImg.src).toContain("/fx-logo.svg");

    expect(
      screen.getByText(
        "l10n string: [landing-reviews-logo-title], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("l10n string: [landing-reviews-add-ons], with vars: {}"),
    ).toBeInTheDocument();
    expect(screen.getByText("4.1")).toBeInTheDocument();
    expect(
      screen.getByText(
        'l10n string: [landing-reviews-rating], with vars: {"review_count":"1,259"}',
      ),
    ).toBeInTheDocument();
  });

  it("shows aggregate stars (relaxed assertion)", () => {
    setup();
    // Just assert we render several icons and the numeric rating
    const allIcons = screen.getAllByTestId("svg-icon");
    expect(allIcons.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("4.1")).toBeInTheDocument();
  });

  it("initially shows first user review details and stars", () => {
    setup();
    expect(screen.getByText("Jon")).toBeInTheDocument();
    expect(
      screen.getByText(
        "l10n string: [landing-reviews-details-source], with vars: {}",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("svg-icon").length).toBeGreaterThanOrEqual(5);
  });

  it("navigates to the last review on previous button (desktop controls)", async () => {
    const { user } = setup();
    const prevBtn = screen.getAllByRole("button", {
      name: "l10n string: [landing-reviews-show-previous-button], with vars: {}",
    })[0];

    await user.click(prevBtn);

    // After going to previous, we expect the anonymous review to appear
    expect(
      screen.getByText((content) =>
        content.startsWith("l10n string: [landing-review-anonymous-user]"),
      ),
    ).toBeInTheDocument();
  });

  it("navigates back to the first review on next button (desktop controls)", async () => {
    const { user } = setup();
    const prevBtn = screen.getAllByRole("button", {
      name: "l10n string: [landing-reviews-show-previous-button], with vars: {}",
    })[0];
    await user.click(prevBtn);

    const nextBtn = screen.getAllByRole("button", {
      name: "l10n string: [landing-reviews-show-next-button], with vars: {}",
    })[0];
    await user.click(nextBtn);

    expect(screen.getByText("Jon")).toBeInTheDocument();
  });

  it("mobile controls also navigate between reviews", async () => {
    const { user } = setup();
    const mobilePrev = screen.getAllByRole("button", {
      name: "l10n string: [landing-reviews-show-previous-button], with vars: {}",
    })[1];
    await user.click(mobilePrev);

    const anonName = screen.getByText((content) =>
      content.startsWith("l10n string: [landing-review-anonymous-user]"),
    );
    expect(anonName).toBeInTheDocument();

    const mobileNext = screen.getAllByRole("button", {
      name: "l10n string: [landing-reviews-show-next-button], with vars: {}",
    })[1];
    await user.click(mobileNext);

    expect(screen.getByText("Jon")).toBeInTheDocument();
  });

  it("formats the aggregate rating number using the locale from getLocale", () => {
    setup("de-DE");
    expect(screen.getByText("4,1")).toBeInTheDocument();
  });
});
