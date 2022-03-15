import React from "react";
import { jest, describe, it, expect } from "@jest/globals";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";
import { mockNextRouter } from "../../../__mocks__/modules/next__router";
import { mockReactGa } from "../../../__mocks__/modules/react-ga";
import { mockConfigModule } from "../../../__mocks__/configMock";
import { setMockProfileData, setMockProfileDataOnce } from "../../../__mocks__/hooks/api/profile";
import { setMockUserData } from "../../../__mocks__/hooks/api/user";
import { getMockRandomAlias, setMockAliasesData, setMockAliasesDataOnce } from "../../../__mocks__/hooks/api/aliases";
import { getMockPremiumCountriesDataWithoutPremium, getMockPremiumCountriesDataWithPremium, setMockPremiumCountriesData, setMockPremiumCountriesDataOnce } from "../../../__mocks__/hooks/api/premiumCountries";

// Important: make sure mocks are imported *before* the page under test:
import Profile from "./profile.page";
import { AliasUpdateFn } from "../../hooks/api/aliases";
import { ProfileUpdateFn } from "../../hooks/api/profile";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("next/router", () => mockNextRouter);
jest.mock("react-ga", () => mockReactGa);
jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/gaPing.ts");

setMockAliasesData();
setMockProfileData();
setMockUserData();
setMockPremiumCountriesData();

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
    });

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
    });
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

    const countOf2 = screen.getByText(/profile-stat-label-aliases-used/);

    // Unfortunately we can't select by role=definition to directly query for
    // the parent item, so we'll have to make do with this crutch. See:
    // https://github.com/testing-library/dom-testing-library/issues/1083
    // eslint-disable-next-line testing-library/no-node-access
    expect(countOf2.parentElement?.textContent).toMatch("2");
  });

  it("shows a count of total emails forwarded for Premium users", () => {
    setMockProfileDataOnce({ has_premium: true });
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
    setMockProfileDataOnce({ has_premium: true });
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

  it("shows the domain search form for Premium users that do not have a domain yet", () => {
    setMockProfileDataOnce({ has_premium: true, subdomain: null });
    render(<Profile />);

    const domainSearchField = screen.getByLabelText("l10n string: [banner-choose-subdomain-input-placeholder], with vars: {}");

    expect(domainSearchField).toBeInTheDocument();
  });

  it("does not show the domain search form for non-Premium users", () => {
    setMockProfileDataOnce({ has_premium: false });
    render(<Profile />);

    const domainSearchField = screen.queryByLabelText("l10n string: [banner-choose-subdomain-input-placeholder], with vars: {}");

    expect(domainSearchField).not.toBeInTheDocument();
  });

  it("does not show the domain search form for Premium users that already have a subdomain", () => {
    setMockProfileDataOnce({ has_premium: true, subdomain: "arbitrary_subdomain" });
    render(<Profile />);

    const domainSearchField = screen.queryByLabelText("l10n string: [banner-choose-subdomain-input-placeholder], with vars: {}");

    expect(domainSearchField).not.toBeInTheDocument();
  });

  it("shows a banner to download Firefox if using a different browser", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36", configurable: true });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent});

    const firefoxBanner = screen.getByRole("link", { name: "l10n string: [banner-download-firefox-cta], with vars: {}" });

    expect(firefoxBanner).toBeInTheDocument();
  });

  it("does not show a banner to download Firefox if the user is already using it", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0", configurable: true });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent});

    const firefoxBanner = screen.queryByRole("link", { name: "l10n string: [banner-download-firefox-cta], with vars: {}" });

    expect(firefoxBanner).not.toBeInTheDocument();
  });

  it("shows a banner to download the add-on if the user is using Firefox", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0", configurable: true });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent});

    const addonBanner = screen.getByRole("link", { name: "l10n string: [banner-download-install-extension-cta], with vars: {}" });

    expect(addonBanner).toBeInTheDocument();
  });

  it("tells the add-on to hide the banner to install the add-on", () => {
    // navigator.userAgent is read-only, so we use `Object.defineProperty`
    // as a workaround to be able to replace it with mock data anyway:
    const previousUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", { value: "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:57.0) Gecko/20100101 Firefox/57.0", configurable: true });
    render(<Profile />);
    Object.defineProperty(navigator, "userAgent", { value: previousUserAgent});

    const addonBanner = screen.getByRole("link", { name: "l10n string: [banner-download-install-extension-cta], with vars: {}" });

    // testing-library generally discourages traversing the DOM directly,
    // but it also discourages matching on class names. However, in this case,
    // the presence of the class name is exactly what tells the add-on to hide
    // the banner, so that doesn't leave us much choice:
    // eslint-disable-next-line testing-library/no-node-access
    expect(addonBanner.closest(".is-hidden-with-addon")).not.toBeNull();
  });

  it("shows a banner to upgrade to Premium if the user does not have Premium yet and Premium is available in their country", () => {
    setMockProfileDataOnce({ has_premium: false });
    setMockPremiumCountriesDataOnce(getMockPremiumCountriesDataWithPremium());
    render(<Profile />);

    const premiumBanner = screen.getByRole("link", { name: "l10n string: [banner-upgrade-cta], with vars: {}" });

    expect(premiumBanner).toBeInTheDocument();
  });

  it("does not show a banner to upgrade to Premium if the user already has Premium", () => {
    setMockProfileDataOnce({ has_premium: true });
    setMockPremiumCountriesDataOnce(getMockPremiumCountriesDataWithPremium());
    
    render(<Profile />);

    const premiumBanner = screen.queryByRole("link", { name: "l10n string: [banner-upgrade-cta], with vars: {}" });

    expect(premiumBanner).not.toBeInTheDocument();
  });

  it("does not show a banner to upgrade to Premium if Premium is not available in the user's country", () => {
    setMockProfileDataOnce({ has_premium: false });
    setMockPremiumCountriesDataOnce(getMockPremiumCountriesDataWithoutPremium());
    
    render(<Profile />);

    const premiumBanner = screen.queryByRole("link", { name: "l10n string: [banner-upgrade-cta], with vars: {}" });

    expect(premiumBanner).not.toBeInTheDocument();
  });

  it("shows a search field to filter aliases if the user has Premium", () => {
    setMockProfileDataOnce({ has_premium: true });
    
    render(<Profile />);

    const searchFilter = screen.getByLabelText("l10n string: [profile-filter-search-placeholder], with vars: {}");

    expect(searchFilter).toBeInTheDocument();
  });

  it("does not show a search field to filter aliases if the user does not have Premium", () => {
    setMockProfileDataOnce({ has_premium: false });
    
    render(<Profile />);

    const searchFilter = screen.queryByLabelText("l10n string: [profile-filter-search-placeholder], with vars: {}");

    expect(searchFilter).not.toBeInTheDocument();
  });

  it("shows the Premium onboarding when the user has Premium and hasn't completed the onboarding yet", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 0 });
    
    render(<Profile />);

    const onboardingHeading = screen.getByRole("heading", { name: "l10n string: [multi-part-onboarding-premium-welcome-headline], with vars: {}" });

    expect(onboardingHeading).toBeInTheDocument();
  });

  it("does not show aliases when onboarding the user", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 0 });
    
    render(<Profile />);

    // The alias filter servers as a proxy here for the aliases being shown:
    const searchFilter = screen.queryByLabelText("l10n string: [profile-filter-search-placeholder], with vars: {}");

    expect(searchFilter).not.toBeInTheDocument();
  });

  it("does not show the Premium onboarding when the user does not have Premium", () => {
    setMockProfileDataOnce({ has_premium: false, onboarding_state: 0 });
    
    render(<Profile />);

    const onboardingHeading = screen.queryByRole("heading", { name: "l10n string: [multi-part-onboarding-premium-welcome-headline], with vars: {}" });

    expect(onboardingHeading).not.toBeInTheDocument();
  });

  it("allows picking a subdomain in the second step of the Premium onboarding", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 1, subdomain: null });
    
    render(<Profile />);

    const subdomainSearchField = screen.getByLabelText("l10n string: [banner-choose-subdomain-input-placeholder], with vars: {}");

    expect(subdomainSearchField).toBeInTheDocument();
  });

  it("does not allow picking a subdomain in the second step of Premium onboarding if the user already has a subdomain", () => {
    setMockProfileDataOnce({ has_premium: true, onboarding_state: 1, subdomain: "arbitrary_subdomain" });
    
    render(<Profile />);

    const subdomainSearchField = screen.queryByLabelText("l10n string: [banner-choose-subdomain-input-placeholder], with vars: {}");

    expect(subdomainSearchField).not.toBeInTheDocument();
  });

  it("allows skipping the Premium onboarding", () => {
    const updateFn: ProfileUpdateFn = jest.fn();
    setMockProfileDataOnce({ id: 42, has_premium: true, onboarding_state: 0 }, { updater: updateFn });
    render(<Profile />);

    const skipButton = screen.getByRole("button", { name: "l10n string: [profile-label-skip], with vars: {}" });
    userEvent.click(skipButton);

    expect(updateFn).toHaveBeenCalledWith(42, { onboarding_state: 3 });
  });

  it("allows disabling an alias", () => {
    const updateFn: AliasUpdateFn = jest.fn();
    setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []}, { updaters: { random: updateFn } });
    render(<Profile />);

    const aliasToggleButton = screen.getByRole("button", { name: "l10n string: [profile-label-disable-forwarding-button], with vars: {}" });
    userEvent.click(aliasToggleButton);

    expect(updateFn).toHaveBeenCalledWith({enabled: false, id: 42});
  });

  it("shows the Generate Alias button if the user is not at the max number of aliases", () => {
    setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
    setMockProfileDataOnce({ has_premium: false });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 5,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows a disabled Generate Alias button if the user is at the max number of aliases, and Premium is not available to them", () => {
    setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
    setMockProfileDataOnce({ has_premium: false });
    setMockPremiumCountriesData({ premium_available_in_country: false });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeDisabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows the upgrade button if the user is at the max number of aliases, and Premium is available to them", () => {
    setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
    setMockProfileDataOnce({ has_premium: false });
    setMockPremiumCountriesData({ premium_available_in_country: true });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const upgradeButton = screen.getByRole("link", { name: "l10n string: [profile-label-upgrade], with vars: {}" });

    expect(upgradeButton).toBeInTheDocument();
    expect(upgradeButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  it("shows the Generate Alias button if the user is at the max number of aliases, but has Premium", () => {
    setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
    setMockProfileDataOnce({ has_premium: true });
    const mockedConfig = mockConfigModule.getRuntimeConfig();
    // getRuntimeConfig() is called frequently, so mock its return value,
    // then restore the original mock at the end of this test:
    mockConfigModule.getRuntimeConfig.mockReturnValue({
      ...mockedConfig,
      maxFreeAliases: 1,
    });
    render(<Profile />);

    const generateAliasButton = screen.getByRole("button", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });

    expect(generateAliasButton).toBeInTheDocument();
    expect(generateAliasButton).toBeEnabled();
    mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
  });

  describe("with the `generateCustomAlias` feature flag enabled", () => {
    it("shows the Generate Alias button if the user is at the max number of aliases, but has Premium, and does not have a custom domain set", () => {
      setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
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

      const generateAliasButton = screen.getByRole("button", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });

      expect(generateAliasButton).toBeInTheDocument();
      expect(generateAliasButton).toBeEnabled();
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });

    it("shows a dropdown to generate random and custom aliases if the user has Premium and has a custom domain set", () => {
      setMockAliasesDataOnce({ random: [ { enabled: true, id: 42 } ], custom: []});
      setMockProfileDataOnce({ has_premium: true, subdomain: "some_subdomain" });
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

      const generateAliasDropdown = screen.getByRole("button", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });
      userEvent.click(generateAliasDropdown);
      const generateAliasMenu = screen.getByRole("menu", { name: "l10n string: [profile-label-generate-new-alias], with vars: {}" });
      const generateRandomAliasMenuItem = screen.getByRole("menuitem", { name: "l10n string: [profile-label-generate-new-alias-menu-random], with vars: {}" });
      const generateCustomAliasMenuItem = screen.getByRole("menuitem", { name: `l10n string: [profile-label-generate-new-alias-menu-custom], with vars: ${JSON.stringify({subdomain:"some_subdomain"})}` });

      expect(generateAliasMenu).toBeInTheDocument();
      expect(generateRandomAliasMenuItem).toBeInTheDocument();
      expect(generateCustomAliasMenuItem).toBeInTheDocument();
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });
  });
});
