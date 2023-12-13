import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import Image from "next/image";
import FirefoxLogo from "./dashboard/images/fx-logo.svg";

jest.mock("../hooks/l10n.ts", () => mockUseL10nModule);

import { mockUseL10nModule } from "../../__mocks__/hooks/l10n";

import { Banner } from "./Banner";

describe("<Banner>", () => {
  it("renders a warning banner with a title", () => {
    render(
      <Banner type="warning" title="Warning Banner">
        Banner content
      </Banner>,
    );

    expect(screen.getByText("Warning Banner")).toBeInTheDocument();
    expect(screen.getByText("Banner content")).toBeInTheDocument();
  });

  it("renders an info banner with an illustration", () => {
    render(
      <Banner
        type="info"
        title="Info Banner"
        illustration={{
          img: (
            <Image
              src={FirefoxLogo}
              alt="Firefox Logo"
              width={60}
              height={60}
            />
          ),
        }}
      >
        Banner content
      </Banner>,
    );

    expect(screen.getByText("Info Banner")).toBeInTheDocument();
    expect(screen.getByText("Banner content")).toBeInTheDocument();
    expect(screen.getByAltText("Firefox Logo")).toBeInTheDocument();
  });

  it("dismisses the banner when the dismiss button is clicked", () => {
    render(
      <Banner type="promo" title="Promo Banner" dismissal={{ key: "promo" }}>
        Banner content
      </Banner>,
    );

    expect(screen.getByText("Promo Banner")).toBeInTheDocument();
    expect(screen.getByText("Banner content")).toBeInTheDocument();

    const dismissButton = screen.getByRole("button", {
      name: "l10n string: [banner-dismiss], with vars: {}",
    });

    fireEvent.click(dismissButton);

    expect(screen.queryByText("Promo Banner")).not.toBeInTheDocument();
    expect(screen.queryByText("Banner content")).not.toBeInTheDocument();
  });
});
