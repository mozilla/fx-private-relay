import React from "react";
import { render, screen } from "@testing-library/react";
import { jest, describe, it, expect } from "@jest/globals";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { setMockProfileData } from "../../../__mocks__/hooks/profile";

import Settings from "./settings";

jest.mock("@fluent/react", () => mockFluentReact);

describe("The settings screen", () => {
  it("shows a warning when the user currently has server-side label storage disabled", () => {
    setMockProfileData({ server_storage: false });
    render(<Settings />);

    const bannerHeading = screen.getByRole("heading", {
      name: "l10n string: [settings-warning-collection-off-heading]",
    });

    expect(bannerHeading).toBeInTheDocument();
  });

  it("does not show a warning when the user currently has server-side label storage enabled", () => {
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    const bannerHeading = screen.queryByRole("heading", {
      name: "l10n string: [settings-warning-collection-off-heading]",
    });

    expect(bannerHeading).not.toBeInTheDocument();
  });
});
