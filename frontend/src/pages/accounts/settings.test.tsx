import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockReactGa } from "../../../__mocks__/modules/react-ga";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import { setMockAliasesData } from "../../../__mocks__/hooks/api/aliases";
import { setMockRuntimeData } from "../../../__mocks__/hooks/api/runtimeData";
import { setMockAddonData } from "../../../__mocks__/hooks/addon";

// Important: make sure mocks are imported *before* the page under test:
import Settings from "./settings.page";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaViewPing.ts");

setMockAliasesData();
setMockProfileData();
setMockRuntimeData();
setMockAddonData();

describe("The settings screen", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<Settings />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
  });

  it("shows a warning when the user currently has server-side label storage disabled", () => {
    setMockProfileData({ server_storage: false });
    render(<Settings />);

    const bannerHeading = screen.getByRole("heading", {
      name: "l10n string: [settings-warning-collection-off-heading-2], with vars: {}",
    });

    expect(bannerHeading).toBeInTheDocument();
  });

  it("does not show a warning when the user currently has server-side label storage enabled", () => {
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    const bannerHeading = screen.queryByRole("heading", {
      name: "l10n string: [settings-warning-collection-off-heading-2], with vars: {}",
    });

    expect(bannerHeading).not.toBeInTheDocument();
  });

  it("shows a warning about turning off server-side label storage when the user toggles it off", async () => {
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    await userEvent.click(
      screen.getByLabelText(
        "l10n string: [setting-label-collection-description-2], with vars: {}"
      )
    );

    const toggleWarning = screen.getByRole("alert");

    expect(toggleWarning).toBeInTheDocument();
  });

  it("does not show a warning about turning off server-side label storage when it was already off without the user toggling it", () => {
    setMockProfileData({ server_storage: false });
    render(<Settings />);

    const bannerHeading = screen.queryByRole("alert");

    expect(bannerHeading).not.toBeInTheDocument();
  });

  it("notifies the add-on when the user toggles server-side label storage off", async () => {
    const addonNotifier = jest.fn();
    setMockAddonData({ sendEvent: addonNotifier });
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    await userEvent.click(
      screen.getByLabelText(
        "l10n string: [setting-label-collection-description-2], with vars: {}"
      )
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "l10n string: [settings-button-save-label], with vars: {}",
      })
    );

    expect(addonNotifier).toHaveBeenCalledWith("serverStorageChange");
  });

  it("notifies the add-on when the user toggles server-side label storage on", async () => {
    const addonNotifier = jest.fn();
    setMockAddonData({ sendEvent: addonNotifier });
    setMockProfileData({ server_storage: false });
    render(<Settings />);

    await userEvent.click(
      screen.getByLabelText(
        "l10n string: [setting-label-collection-description-2], with vars: {}"
      )
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "l10n string: [settings-button-save-label], with vars: {}",
      })
    );

    expect(addonNotifier).toHaveBeenCalledWith("serverStorageChange");
  });
});
