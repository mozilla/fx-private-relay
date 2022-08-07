import React from "react";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockReactGa } from "../../../__mocks__/modules/react-ga";
import { mockReactIntersectionObserver } from "../../../__mocks__/modules/react-intersection-observer";
import { mockConfigModule } from "../../../__mocks__/configMock";
import {
  setMockProfileData,
  setMockProfileDataOnce,
} from "../../../__mocks__/hooks/api/profile";
import { setMockUserData } from "../../../__mocks__/hooks/api/user";
import {
  getMockCustomAlias,
  getMockRandomAlias,
  setMockAliasesData,
  setMockAliasesDataOnce,
} from "../../../__mocks__/hooks/api/aliases";
import {
  getMockRuntimeDataWithoutPremium,
  getMockRuntimeDataWithPremium,
  setMockRuntimeData,
  setMockRuntimeDataOnce,
} from "../../../__mocks__/hooks/api/runtimeData";
import { mockGetLocaleModule } from "../../../__mocks__/functions/getLocale";
import {
  setMockMinViewportWidth,
  setMockMinViewportWidthOnce,
} from "../../../__mocks__/hooks/mediaQuery";
import { mockUseFxaFlowTrackerModule } from "../../../__mocks__/hooks/fxaFlowTracker";
import { setMockAddonData } from "../../../__mocks__/hooks/addon";

// Important: make sure mocks are imported *before* the page under test:
import Profile from "./profile.page";
import { AliasUpdateFn } from "../../hooks/api/aliases";
import { ProfileUpdateFn } from "../../hooks/api/profile";
import { RuntimeConfig } from "../../config";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("react-intersection-observer", () => mockReactIntersectionObserver);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../functions/renderDate.ts");
jest.mock("../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../hooks/api/api.ts", () => ({
  // `authenticatedFetch` is currently only used to check whether a subdomain
  // is available, so we're just mocking that:
  authenticatedFetch: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ available: true }),
    })
  ),
}));
jest.mock("../../hooks/gaViewPing.ts");
jest.mock("../../hooks/fxaFlowTracker.ts", () => mockUseFxaFlowTrackerModule);

setMockAliasesData();
setMockProfileData();
setMockUserData();
setMockRuntimeData();
setMockMinViewportWidth();
setMockAddonData();

describe("The dashboard", () => {
  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      // The label editor sets a timeout when submitted, which axe doesn't wait for.
      // Hence, we disable the label editor by disabling server-side data storage for this user.
      setMockProfileDataOnce({ has_premium: false, server_storage: false });
      const { baseElement } = render(<Profile />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s

    it("passes axe accessibility testing with the Premium user interface", async () => {
      // The label editor sets a timeout when submitted, which axe doesn't wait for.
      // Hence, we disable the label editor by disabling server-side data storage for this user.
      setMockProfileDataOnce({ has_premium: true, server_storage: false });
      const { baseElement } = render(<Profile />);

      let results;
      await act(async () => {
        results = await axe(baseElement);
      });

      expect(results).toHaveNoViolations();
    }, 10000); // axe runs a suite of tests that can exceed the default 5s timeout, so we set it to 10s
  });

  it("shows a count of the user's aliases for Premium users", () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1" }),
        getMockRandomAlias({ address: "address2" }),
      ],
      custom: [],
    });
    render(<Profile />);

    const countOf2 = screen.getByText(/profile-stat-label-aliases-used-2/);

    // Unfortunately we can't select by role=definition to directly query for
    // the parent item, so we'll have to make do with this crutch. See:
    // https://github.com/testing-library/dom-testing-library/issues/1083
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf2.parentElement?.textContent).toMatch("2");
  });

  it("shows a count of total emails forwarded for Premium users", () => {
    setMockProfileDataOnce({ has_premium: true, emails_forwarded: 42 });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1", num_forwarded: 7 }),
        getMockRandomAlias({ address: "address2", num_forwarded: 35 }),
      ],
      custom: [],
    });
    render(<Profile />);

    const countOf42 = screen.getByText(/profile-stat-label-forwarded/);

    // Unfortunately we can't select by role=definition to directly query for
    // the parent item, so we'll have to make do with this crutch. See:
    // https://github.com/testing-library/dom-testing-library/issues/1083
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf42.parentElement?.textContent).toMatch("42");
  });

  it("shows a count of total emails blocked for Premium users", () => {
    setMockProfileDataOnce({ has_premium: true, emails_blocked: 50 });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1", num_blocked: 13 }),
        getMockRandomAlias({ address: "address2", num_blocked: 37 }),
      ],
      custom: [],
    });
    render(<Profile />);

    const countOf50 = screen.getByText(/profile-stat-label-blocked/);

    // Unfortunately we can't select by role=definition to directly query for
    // the parent item, so we'll have to make do with this crutch. See:
    // https://github.com/testing-library/dom-testing-library/issues/1083
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf50.parentElement?.textContent).toMatch("50");
  });

  it("uses the count of total emails blocked/forwarded from the back-end, even when that count includes deleted masks and therefore does not agree with the individual mask counts", () => {
    setMockProfileDataOnce({
      has_premium: true,
      emails_forwarded: 50,
      emails_blocked: 72,
    });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({
          address: "address1",
          num_forwarded: 7,
          num_blocked: 13,
        }),
        getMockRandomAlias({
          address: "address2",
          num_forwarded: 35,
          num_blocked: 37,
        }),
      ],
      custom: [],
    });
    render(<Profile />);

    const countOf50 = screen.getByText(/profile-stat-label-forwarded/);
    const countOf72 = screen.getByText(/profile-stat-label-blocked/);

    // Unfortunately we can't select by role=definition to directly query for
    // the parent item, so we'll have to make do with this crutch. See:
    // https://github.com/testing-library/dom-testing-library/issues/1083
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf50.parentElement?.textContent).toMatch("50");
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf72.parentElement?.textContent).toMatch("72");
  });

  it("shows the domain search form for Premium users that do not have a domain yet", () => {
    setMockProfileDataOnce({ has_premium: true, subdomain: null });
    render(<Profile />);

    const domainSearchField = screen.getByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    expect(domainSearchField).toBeInTheDocument();
  });

  it("does not show the domain search form for non-Premium users", () => {
    setMockProfileDataOnce({ has_premium: false });
    render(<Profile />);

    const domainSearchField = screen.queryByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    expect(domainSearchField).not.toBeInTheDocument();
  });

  it("does not show the domain search form for Premium users that already have a subdomain", () => {
    setMockProfileDataOnce({
      has_premium: true,
      subdomain: "arbitrary_subdomain",
    });
    render(<Profile />);

    const domainSearchField = screen.queryByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    expect(domainSearchField).not.toBeInTheDocument();
  });

  it("shows that capital letters in searched-for subdomains will be lowercased", async () => {
    setMockProfileDataOnce({ has_premium: true, subdomain: null });
    render(<Profile />);

    const domainSearchField = screen.getByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    await userEvent.type(domainSearchField, "SpoNGeBoB");

    const preview = screen.getByText("spongebob");
    expect(preview).toBeInTheDocument();

    const searchButton = screen.getByRole("button", {
      name: "l10n string: [banner-register-subdomain-button-search], with vars: {}",
    });
    await userEvent.click(searchButton);

    const subdomainDialog = screen.getByRole("dialog", {
      name: '[<Localized> with id [modal-domain-register-available-2] and vars: {"subdomain":"spongebob","domain":"mozmail.com"}]',
    });
    expect(subdomainDialog).toBeInTheDocument();
  });

  it("shows a banner to download Firefox if using a different browser that does not support Chrome extensions", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1",
      configurable: true,
    });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const firefoxBanner = screen.getByRole("link", {
      name: "l10n string: [banner-download-firefox-cta], with vars: {}",
    });

    expect(firefoxBanner).toBeInTheDocument();
  });

  it("shows a banner to download the Chrome extension if using a different browser that supports Chrome extensions", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
      configurable: true,
    });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const chromeExtensionBanner = screen.getByRole("link", {
      name: "l10n string: [banner-download-install-chrome-extension-cta], with vars: {}",
    });

    expect(chromeExtensionBanner).toBeInTheDocument();
  });

  it("shows a banner to download Firefox if using a different browser that on desktop supports Chrome extensions, but is running on a small screen and thus probably does not support extensions", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
      configurable: true,
    });
    setMockMinViewportWidthOnce(false);
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const chromeExtensionBanner = screen.queryByRole("link", {
      name: "l10n string: [banner-download-install-chrome-extension-cta], with vars: {}",
    });
    const firefoxBanner = screen.getByRole("link", {
      name: "l10n string: [banner-download-firefox-cta], with vars: {}",
    });

    expect(chromeExtensionBanner).not.toBeInTheDocument();
    expect(firefoxBanner).toBeInTheDocument();
  });

  it("does not show a banner to download Firefox if the user is already using it", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
      configurable: true,
    });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const firefoxBanner = screen.queryByRole("link", {
      name: "l10n string: [banner-download-firefox-cta], with vars: {}",
    });

    expect(firefoxBanner).not.toBeInTheDocument();
  });

  it("shows a banner to download the add-on if the user is using Firefox", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
      configurable: true,
    });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const addonBanner = screen.getByRole("link", {
      name: "l10n string: [banner-download-install-extension-cta], with vars: {}",
    });

    expect(addonBanner).toBeInTheDocument();
  });

  it("does not show a banner to download the add-on if the user is using Firefox, but on a small screen, and therefore probably on mobile, where the extension is not available", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
      configurable: true,
    });
    setMockMinViewportWidthOnce(false);
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const addonBanner = screen.queryByRole("link", {
      name: "l10n string: [banner-download-install-extension-cta], with vars: {}",
    });

    expect(addonBanner).not.toBeInTheDocument();
  });

  it("tells the add-on to hide the banner to install the add-on", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value:
        "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0",
      configurable: true,
    });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent });

    const addonBanner = screen.getByRole("link", {
      name: "l10n string: [banner-download-install-extension-cta], with vars: {}",
    });

    // testing-library generally discourages traversing the DOM directly,
    // but it also discourages matching on class names. However, in this case,
    // the presence of the class name is exactly what tells the add-on to hide
    // the banner, so that doesn't leave us much choice:
    // eslint-disable-next-line testing-library/no-node-access
    expect(addonBanner.closest(".is-hidden-with-addon")).not.toBeNull();
  });

  it("shows a banner to upgrade to Premium if the user does not have Premium yet and Premium is available in their country", () => {
    setMockProfileDataOnce({ has_premium: false });
    setMockRuntimeDataOnce(getMockRuntimeDataWithPremium());
    render(<Profile />);

    const premiumBanner = screen.getByRole("link", {
      name: "l10n string: [banner-upgrade-loyalist-cta], with vars: {}",
    });

    expect(premiumBanner).toBeInTheDocument();
  });

  it("does not show a banner to upgrade to Premium if the user already has Premium", () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockRuntimeDataOnce(getMockRuntimeDataWithPremium());

    render(<Profile />);

    const premiumBanner = screen.queryByRole("link", {
      name: "l10n string: [banner-upgrade-cta], with vars: {}",
    });

    expect(premiumBanner).not.toBeInTheDocument();
  });

  it("does not show a banner to upgrade to Premium if Premium is not available in the user's country", () => {
    setMockProfileDataOnce({ has_premium: false });
    setMockRuntimeDataOnce(getMockRuntimeDataWithoutPremium());

    render(<Profile />);

    const premiumBanner = screen.queryByRole("link", {
      name: "l10n string: [banner-upgrade-cta], with vars: {}",
    });

    expect(premiumBanner).not.toBeInTheDocument();
  });

  it("shows a search field to filter aliases if the user has Premium", () => {
    setMockProfileDataOnce({ has_premium: true });

    render(<Profile />);

    const searchFilter = screen.getAllByLabelText(
      "l10n string: [profile-filter-search-placeholder-2], with vars: {}"
    );

    expect(searchFilter[0]).toBeInTheDocument();
  });

  it("also shows a search field to filter aliases if the user does not have Premium", () => {
    setMockProfileDataOnce({ has_premium: false });

    render(<Profile />);

    const searchFilter = screen.getAllByLabelText(
      "l10n string: [profile-filter-search-placeholder-2], with vars: {}"
    );

    expect(searchFilter[0]).toBeInTheDocument();
  });

  it("shows the Premium onboarding when the user has Premium and hasn't completed the onboarding yet", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 0 });

    render(<Profile />);

    const onboardingHeading = screen.getByRole("heading", {
      name: "l10n string: [multi-part-onboarding-premium-welcome-headline], with vars: {}",
    });

    expect(onboardingHeading).toBeInTheDocument();
  });

  it("does not show aliases when onboarding the user", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 0 });

    render(<Profile />);

    // The alias filter servers as a proxy here for the aliases being shown:
    const searchFilter = screen.queryByLabelText(
      "l10n string: [profile-filter-search-placeholder-2], with vars: {}"
    );

    expect(searchFilter).not.toBeInTheDocument();
  });

  it("does not show the Premium onboarding when the user does not have Premium", () => {
    setMockProfileDataOnce({ has_premium: false, onboarding_state: 0 });

    render(<Profile />);

    const onboardingHeading = screen.queryByRole("heading", {
      name: "l10n string: [multi-part-onboarding-premium-welcome-headline], with vars: {}",
    });

    expect(onboardingHeading).not.toBeInTheDocument();
  });

  it("exposes user data to the add-on when onboarding the user", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 0 });

    const { container } = render(<Profile />);

    // Since we're explicitly testing for something that's not visible to the user,
    // but instead is for data exposed to the add-on which will explicitly be
    // looking for this tag name, direct node access (i.e. mimicking the API
    // used by the add-on) is fine here:
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    const addonDataElements = container.getElementsByTagName(
      "firefox-private-relay-addon-data"
    );

    expect(addonDataElements).toHaveLength(1);
    expect(addonDataElements[0]).toBeInTheDocument();
  });

  it("allows picking a subdomain in the second step of the Premium onboarding", () => {
    setMockProfileDataOnce({
      has_premium: true,
      onboarding_state: 1,
      subdomain: null,
    });

    render(<Profile />);

    const subdomainSearchField = screen.getByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    expect(subdomainSearchField).toBeInTheDocument();
  });

  it("shows that searched-for subdomains will be lowercased in the second step of Premium onboarding", async () => {
    setMockProfileDataOnce({
      has_premium: true,
      onboarding_state: 1,
      subdomain: null,
    });

    render(<Profile />);

    const subdomainSearchField = screen.getByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    await userEvent.type(subdomainSearchField, "sPoNGeBob");

    const preview = screen.getByText("spongebob");
    expect(preview).toBeInTheDocument();

    const searchButton = screen.getByRole("button", {
      name: "l10n string: [banner-register-subdomain-button-search], with vars: {}",
    });
    await userEvent.click(searchButton);

    const subdomainDialog = screen.getByRole("dialog", {
      name: '[<Localized> with id [modal-domain-register-available-2] and vars: {"subdomain":"spongebob","domain":"mozmail.com"}]',
    });
    expect(subdomainDialog).toBeInTheDocument();
  });

  it("does not allow picking a subdomain in the second step of Premium onboarding if the user already has a subdomain", () => {
    setMockProfileDataOnce({
      has_premium: true,
      onboarding_state: 1,
      subdomain: "arbitrary_subdomain",
    });

    render(<Profile />);

    const subdomainSearchField = screen.queryByLabelText(
      "l10n string: [banner-choose-subdomain-input-placeholder-3], with vars: {}"
    );

    expect(subdomainSearchField).not.toBeInTheDocument();
  });

  it("allows skipping the Premium onboarding", async () => {
    const updateFn: ProfileUpdateFn = jest.fn();
    setMockProfileDataOnce(
      { id: 42, has_premium: true, onboarding_state: 0 },
      { updater: updateFn }
    );
    render(<Profile />);

    const skipButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-skip], with vars: {}",
    });
    await userEvent.click(skipButton);

    expect(updateFn).toHaveBeenCalledWith(42, { onboarding_state: 3 });
  });

  it("allows disabling an alias", async () => {
    const updateFn: AliasUpdateFn = jest.fn();
    setMockAliasesDataOnce(
      { random: [{ enabled: true, id: 42 }], custom: [] },
      { updater: updateFn }
    );
    render(<Profile />);

    const blockLevelSlider = screen.getByRole("slider", {
      name: "l10n string: [profile-promo-email-blocking-title], with vars: {}",
    });
    await userEvent.click(blockLevelSlider);
    await userEvent.keyboard("[ArrowRight][ArrowRight]");

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, mask_type: "random" }),
      { enabled: false }
    );
  });

  it("shows the Generate Alias button if the user is not at the max number of aliases", () => {
    setMockAliasesDataOnce({ random: [{ enabled: true, id: 42 }], custom: [] });
    setMockProfileDataOnce({ has_premium: false });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 5,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
    });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows a disabled Generate Alias button if the user is at the max number of aliases, and Premium is not available to them", () => {
    setMockAliasesDataOnce({ random: [{ enabled: true, id: 42 }], custom: [] });
    setMockProfileDataOnce({ has_premium: false });
    setMockRuntimeData(getMockRuntimeDataWithoutPremium());
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
    });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeDisabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows the upgrade button if the user is at the max number of aliases, and Premium is available to them", () => {
    setMockAliasesDataOnce({ random: [{ enabled: true, id: 42 }], custom: [] });
    setMockProfileDataOnce({ has_premium: false });
    setMockRuntimeData(getMockRuntimeDataWithPremium());
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const upgradeButton = screen.getByRole("link", {
      name: "l10n string: [profile-label-upgrade-2], with vars: {}",
    });

    expect(upgradeButton).toBeInTheDocument();
    expect(upgradeButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows the Generate Alias button if the user is at the max number of aliases, but has Premium", () => {
    setMockAliasesDataOnce({ random: [{ enabled: true, id: 42 }], custom: [] });
    setMockProfileDataOnce({ has_premium: true });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
    });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows the category filter button if the user has Premium", () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockAliasesDataOnce({ random: [{ enabled: true, id: 42 }], custom: [] });

    render(<Profile />);

    const categoryFilterButton = screen.getByRole("button", {
      name: "l10n string: [profile-filter-category-button-tooltip], with vars: {}",
    });

    expect(categoryFilterButton).toBeInTheDocument();
  });

  it("has a category filter for the list of aliases that can be closed and applied, which is available to users with premium", async () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1" }),
        getMockRandomAlias({ address: "address2" }),
      ],
      custom: [getMockCustomAlias({ address: "address3" })],
    });

    render(<Profile />);

    // Open and select a category filter option
    const categoryFilterButton = screen.getByRole("button", {
      name: "l10n string: [profile-filter-category-button-tooltip], with vars: {}",
    });
    await userEvent.click(categoryFilterButton);

    const categoryFilterCheckboxCustomMask = screen.getByLabelText(
      "l10n string: [profile-filter-category-option-custom-masks], with vars: {}"
    );
    await userEvent.click(categoryFilterCheckboxCustomMask);

    // Apply category filter selection
    const categoryFilterApplyButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-apply], with vars: {}",
    });
    await userEvent.click(categoryFilterApplyButton);

    const randomAlias1 = screen.queryByText(/address1/);
    const randomAlias2 = screen.queryByText(/address2/);
    expect(randomAlias1).not.toBeInTheDocument();
    expect(randomAlias2).not.toBeInTheDocument();

    const customAlias = screen.queryByText(/address3/);
    expect(customAlias).toBeInTheDocument();
  });

  it("has a category filter for the list of aliases that can be closed and cancelled, which is available to users with premium", async () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1" }),
        getMockRandomAlias({ address: "address2" }),
      ],
      custom: [getMockCustomAlias({ address: "address3" })],
    });

    render(<Profile />);

    // Open and select a category filter option
    const categoryFilterButton = screen.getByRole("button", {
      name: "l10n string: [profile-filter-category-button-tooltip], with vars: {}",
    });
    await userEvent.click(categoryFilterButton);

    const categoryFilterCheckboxRandomMask = screen.getByLabelText(
      "l10n string: [profile-filter-category-option-random-masks], with vars: {}"
    );
    await userEvent.click(categoryFilterCheckboxRandomMask);

    // Close and discard changes
    await userEvent.click(categoryFilterButton);

    const randomAlias1 = screen.queryByText(/address1/);
    const randomAlias2 = screen.queryByText(/address2/);
    expect(randomAlias1).toBeInTheDocument();
    expect(randomAlias2).toBeInTheDocument();

    const customAlias = screen.queryByText(/address3/);
    expect(customAlias).toBeInTheDocument();
  });

  it("has a category filter for the list of aliases that can be closed and cleared, which is available to users with premium", async () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockAliasesDataOnce({
      random: [
        getMockRandomAlias({ address: "address1" }),
        getMockRandomAlias({ address: "address2" }),
      ],
      custom: [getMockCustomAlias({ address: "address3" })],
    });

    render(<Profile />);

    // Open and select a category filter option
    const categoryFilterButton = screen.getByRole("button", {
      name: "l10n string: [profile-filter-category-button-tooltip], with vars: {}",
    });
    await userEvent.click(categoryFilterButton);

    const categoryFilterCheckboxCustomMask = screen.getByLabelText(
      "l10n string: [profile-filter-category-option-custom-masks], with vars: {}"
    );
    await userEvent.click(categoryFilterCheckboxCustomMask);

    // Apply category filter selection
    const categoryFilterApplyButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-reset], with vars: {}",
    });
    await userEvent.click(categoryFilterApplyButton);

    // Reopen and clear category filter selection
    await userEvent.click(categoryFilterButton);
    await userEvent.click(categoryFilterCheckboxCustomMask);

    const categoryFilterResetButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-reset], with vars: {}",
    });
    await userEvent.click(categoryFilterResetButton);

    const randomAlias1 = screen.queryByText(/address1/);
    const randomAlias2 = screen.queryByText(/address2/);
    expect(randomAlias1).toBeInTheDocument();
    expect(randomAlias2).toBeInTheDocument();

    const customAlias = screen.queryByText(/address3/);
    expect(customAlias).toBeInTheDocument();
  });

  it("exposes user data to the add-on", () => {
    const { container } = render(<Profile />);

    // Since we're explicitly testing for something that's not visible to the user,
    // but instead is for data exposed to the add-on which will explicitly be
    // looking for this tag name, direct node access (i.e. mimicking the API
    // used by the add-on) is fine here:
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    const addonDataElements = container.getElementsByTagName(
      "firefox-private-relay-addon-data"
    );

    expect(addonDataElements).toHaveLength(1);
    expect(addonDataElements[0]).toBeInTheDocument();
  });

  it("notifies the add-on when the user creates a new alias", async () => {
    const addonNotifier = jest.fn();
    setMockAddonData({ sendEvent: addonNotifier });
    setMockAliasesDataOnce({ random: [], custom: [] });
    setMockProfileDataOnce({ has_premium: false });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
    });
    await userEvent.click(generateAliasButton);

    expect(addonNotifier).toHaveBeenCalledWith("aliasListUpdate");
  });

  it("notifies the add-on when the user deletes an alias", async () => {
    const addonNotifier = jest.fn();
    setMockAddonData({ sendEvent: addonNotifier });
    setMockAliasesDataOnce({ random: [{ id: 42 }], custom: [] });
    setMockProfileDataOnce({ has_premium: false });
    render(<Profile />);

    const aliasDeleteButton = screen.getByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });
    await userEvent.click(aliasDeleteButton);

    const confirmationCheckbox = screen.getByLabelText(
      "l10n string: [modal-delete-confirmation-2], with vars: {}"
    );
    await userEvent.click(confirmationCheckbox);

    const confirmationButton = screen.getAllByRole("button", {
      name: "l10n string: [profile-label-delete], with vars: {}",
    });
    await userEvent.click(confirmationButton[1]);

    expect(addonNotifier).toHaveBeenCalledWith("aliasListUpdate");
  });

  describe("with the `tips` feature flag enabled", () => {
    let mockedConfig: RuntimeConfig;

    beforeEach(() => {
      mockedConfig = mockConfigModule.getRuntimeConfig();
      // getRuntimeConfig() is called frequently, so mock its return value,
      // then restore the original mock at the end of every test (in `afterEach`):
      mockConfigModule.getRuntimeConfig.mockReturnValue({
        ...mockedConfig,
        maxFreeAliases: 1,
        featureFlags: {
          ...mockedConfig.featureFlags,
          tips: true,
        },
      });
    });
    afterEach(() => {
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });

    it("displays a tip about how to use custom aliases to Premium users", () => {
      setMockProfileDataOnce({ has_premium: true });

      render(<Profile />);

      const tipsHeader = screen.getByRole("heading", {
        name: "l10n string: [tips-header-title], with vars: {}",
      });
      const customMaskTip = screen.getByText(
        "l10n string: [tips-custom-alias-heading-2], with vars: {}"
      );

      expect(tipsHeader).toBeInTheDocument();
      expect(customMaskTip).toBeInTheDocument();
    });

    it("does not display a tip about how to use custom aliases to non-Premium users", () => {
      setMockProfileDataOnce({ has_premium: false });

      render(<Profile />);

      const customMaskTip = screen.queryByText(
        "l10n string: [tips-custom-alias-heading-2], with vars: {}"
      );

      expect(customMaskTip).not.toBeInTheDocument();
    });
  });

  describe("with the `generateCustomAlias` feature flag enabled", () => {
    it("shows the Generate Alias button if the user is at the max number of aliases, but has Premium, and does not have a custom domain set", () => {
      setMockAliasesDataOnce({
        random: [{ enabled: true, id: 42 }],
        custom: [],
      });
      setMockProfileDataOnce({ has_premium: true, subdomain: null });
      const mockedConfig = mockConfigModule.getRuntimeConfig();
      // getRuntimeConfig() is called frequently, so mock its return value,
      // then restore the original mock at the end of this test:
      mockConfigModule.getRuntimeConfig.mockReturnValue({
        ...mockedConfig,
        maxFreeAliases: 1,
        featureFlags: {
          ...mockedConfig.featureFlags,
          generateCustomAliasMenu: true,
        },
      });
      render(<Profile />);

      const generateAliasButton = screen.getByRole("button", {
        name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
      });

      expect(generateAliasButton).toBeInTheDocument();
      expect(generateAliasButton).toBeEnabled();
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });

    it("shows a dropdown to generate random and custom aliases if the user has Premium and has a custom domain set", async () => {
      setMockAliasesDataOnce({
        random: [{ enabled: true, id: 42 }],
        custom: [],
      });
      setMockProfileDataOnce({
        has_premium: true,
        subdomain: "some_subdomain",
      });
      const mockedConfig = mockConfigModule.getRuntimeConfig();
      // getRuntimeConfig() is called frequently, so mock its return value,
      // then restore the original mock at the end of this test:
      mockConfigModule.getRuntimeConfig.mockReturnValue({
        ...mockedConfig,
        maxFreeAliases: 1,
        featureFlags: {
          ...mockedConfig.featureFlags,
          generateCustomAliasMenu: true,
        },
      });
      render(<Profile />);

      const generateAliasDropdown = screen.getByRole("button", {
        name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
      });
      await userEvent.click(generateAliasDropdown);
      const generateAliasMenu = screen.getByRole("menu", {
        name: "l10n string: [profile-label-generate-new-alias-2], with vars: {}",
      });
      const generateRandomAliasMenuItem = screen.getByRole("menuitem", {
        name: "l10n string: [profile-label-generate-new-alias-menu-random-2], with vars: {}",
      });
      const generateCustomAliasMenuItem = screen.getByRole("menuitem", {
        name: `l10n string: [profile-label-generate-new-alias-menu-custom-2], with vars: ${JSON.stringify(
          { subdomain: "some_subdomain" }
        )}`,
      });

      expect(generateAliasMenu).toBeInTheDocument();
      expect(generateRandomAliasMenuItem).toBeInTheDocument();
      expect(generateCustomAliasMenuItem).toBeInTheDocument();
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });
  });
});
