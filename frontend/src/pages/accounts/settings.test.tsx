import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockReactGa } from "../../../__mocks__/modules/react-ga";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockProfileData } from "../../../__mocks__/hooks/api/profile";
import { setMockAliasesData } from "../../../__mocks__/hooks/api/aliases";
import {
  setMockRuntimeData,
  getMockRuntimeDataWithPhones,
} from "../../../__mocks__/hooks/api/runtimeData";
import { setMockAddonData } from "../../../__mocks__/hooks/addon";
import { useProfiles } from "../../../src/hooks/api/profile";
import { useRuntimeData } from "../../../src/hooks/api/runtimeData";

jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../../config.ts", () => mockConfigModule);

// This test needs real waffle flags that read from runtime data
jest.unmock("../../functions/waffle");

// Important: make sure mocks are imported *before* the page under test:
import Settings from "./settings.page";

const mockedUseProfiles = useProfiles as jest.MockedFunction<
  typeof useProfiles
>;
const mockedUseRuntimeData = useRuntimeData as jest.MockedFunction<
  typeof useRuntimeData
>;

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
      name: "l10n string: [settings-warning-collection-off-heading-3], with vars: {}",
    });

    expect(bannerHeading).toBeInTheDocument();
  });

  it("does not show a warning when the user currently has server-side label storage enabled", () => {
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    const bannerHeading = screen.queryByRole("heading", {
      name: "l10n string: [settings-warning-collection-off-heading-3], with vars: {}",
    });

    expect(bannerHeading).not.toBeInTheDocument();
  });

  it("shows a warning about turning off server-side label storage when the user toggles it off", async () => {
    setMockProfileData({ server_storage: true });
    render(<Settings />);

    await userEvent.click(
      screen.getByLabelText(
        "l10n string: [setting-label-collection-description-3], with vars: {}",
      ),
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
        "l10n string: [setting-label-collection-description-3], with vars: {}",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "l10n string: [settings-button-save-label], with vars: {}",
      }),
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
        "l10n string: [setting-label-collection-description-3], with vars: {}",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "l10n string: [settings-button-save-label], with vars: {}",
      }),
    );

    expect(addonNotifier).toHaveBeenCalledWith("serverStorageChange");
  });

  it("copies API key to clipboard and shows confirmation", async () => {
    const writeText = jest.fn();
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<Settings />);
    const copyButtons = screen.getAllByTitle(
      "l10n string: [settings-button-copy], with vars: {}",
    );
    const copyButton = copyButtons[0];

    await userEvent.click(copyButton);
    expect(writeText).toHaveBeenCalled();

    const confirmation = screen.getByText(
      "l10n string: [setting-api-key-copied], with vars: {}",
    );
    expect(confirmation).toBeVisible();
  });

  it("shows contact us link if user has premium", () => {
    setMockProfileData({ has_premium: true });
    render(<Settings />);
    const contactLink = screen.getByRole("link", {
      name: /l10n string: \[settings-meta-contact-label\]/i,
    });
    expect(contactLink).toBeInTheDocument();
  });

  it("renders and toggles tracker removal setting if supported and flag is active", async () => {
    setMockProfileData({
      remove_level_one_email_trackers: true,
    });

    setMockRuntimeData({
      WAFFLE_FLAGS: [["tracker_removal", true]],
    });

    render(<Settings />);

    const checkboxes = screen.getAllByRole("checkbox");
    const trackerCheckbox = checkboxes.find(
      (el) => el.getAttribute("name") === "tracker-removal",
    );
    expect(trackerCheckbox).toBeInTheDocument();

    await userEvent.click(trackerCheckbox!);
    expect(trackerCheckbox).not.toBeChecked();
  });

  it("renders nothing if runtime data or profile data is missing", () => {
    mockedUseRuntimeData.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    mockedUseProfiles.mockReturnValueOnce({
      data: undefined,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
      update: jest.fn(),
      setSubdomain: jest.fn(),
    });

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("renders and toggles phone caller/SMS log setting if phones are available", async () => {
    setMockProfileData({
      store_phone_log: true,
    });

    setMockRuntimeData(getMockRuntimeDataWithPhones());

    render(<Settings />);

    const phoneLogCheckbox = screen.getByLabelText(
      "l10n string: [phone-settings-caller-sms-log-description], with vars: {}",
    );
    expect(phoneLogCheckbox).toBeInTheDocument();
    expect(phoneLogCheckbox).toBeChecked();

    await userEvent.click(phoneLogCheckbox);
    expect(phoneLogCheckbox).not.toBeChecked();

    const warning = screen.getByText(
      "l10n string: [phone-settings-caller-sms-log-warning], with vars: {}",
    );
    expect(warning).toBeInTheDocument();
  });

  it("does not render phone caller/SMS log setting if phones are not available", () => {
    setMockProfileData({
      store_phone_log: true,
    });

    setMockRuntimeData({
      PHONE_PLANS: {
        available_in_country: false,
        countries: [],
        country_code: "BE",
        plan_country_lang_mapping: {},
      },
    });

    render(<Settings />);

    const phoneLogCheckbox = screen.queryByLabelText(
      "l10n string: [phone-settings-caller-sms-log-description], with vars: {}",
    );
    expect(phoneLogCheckbox).not.toBeInTheDocument();
  });

  it("shows help/support link in sidebar", () => {
    render(<Settings />);

    const helpLink = screen.getByRole("link", {
      name: /l10n string: \[settings-meta-help-label\]/i,
    });
    expect(helpLink).toBeInTheDocument();
    expect(helpLink).toHaveAttribute(
      "href",
      expect.stringContaining("support"),
    );
  });

  it("shows status link in sidebar", () => {
    render(<Settings />);

    const statusLink = screen.getByRole("link", {
      name: /l10n string: \[settings-meta-status-label\]/i,
    });
    expect(statusLink).toBeInTheDocument();
    expect(statusLink).toHaveAttribute(
      "href",
      "https://status.relay.firefox.com/",
    );
  });

  it("calls update function when saving settings successfully", async () => {
    const updateFn = jest.fn().mockResolvedValue({ ok: true });
    setMockProfileData(
      { id: 1, server_storage: true },
      { updater: updateFn, setSubdomain: jest.fn() },
    );

    render(<Settings />);

    await userEvent.click(
      screen.getByLabelText(
        "l10n string: [setting-label-collection-description-3], with vars: {}",
      ),
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: "l10n string: [settings-button-save-label], with vars: {}",
      }),
    );

    expect(updateFn).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        server_storage: false,
      }),
    );
  });
});
