import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { getMockRandomAlias } from "../../../../__mocks__/hooks/api/aliases";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import {
  getMockRuntimeDataWithoutPremium,
  getMockRuntimeDataWithPremium,
} from "../../../../__mocks__/hooks/api/runtimeData";
import { mockFluentReact } from "../../../../__mocks__/modules/fluent__react";

import { AliasGenerationButton } from "./AliasGenerationButton";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("../../../config.ts", () => mockConfigModule);
jest.mock("../../../hooks/gaViewPing.ts");

describe("<AliasGenerationButton>", () => {
  it("displays a usable button to generate an alias for a free user not at the alias limit", () => {
    render(
      <AliasGenerationButton
        aliases={[getMockRandomAlias()]}
        profile={getMockProfileData({ has_premium: false })}
        onCreate={jest.fn()}
        runtimeData={getMockRuntimeDataWithoutPremium()}
      />
    );

    const button = screen.getByRole("button");

    expect(button).toBeEnabled();
    expect(button).toHaveTextContent(
      "l10n string: [profile-label-generate-new-alias-2], with vars: {}"
    );
  });

  it("displays a usable button to generate an alias for a Premium user over the free-user alias limit", () => {
    render(
      <AliasGenerationButton
        aliases={[
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
        ]}
        profile={getMockProfileData({ has_premium: true })}
        onCreate={jest.fn()}
        runtimeData={getMockRuntimeDataWithoutPremium()}
      />
    );

    const button = screen.getByRole("button");

    expect(button).toBeEnabled();
    expect(button).toHaveTextContent(
      "l10n string: [profile-label-generate-new-alias-2], with vars: {}"
    );
  });

  it("displays an upgrade button when a free user has reached the alias limit, and Premium is available in their country", () => {
    render(
      <AliasGenerationButton
        aliases={[
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
        ]}
        profile={getMockProfileData({ has_premium: false })}
        onCreate={jest.fn()}
        runtimeData={getMockRuntimeDataWithPremium()}
      />
    );

    const button = screen.getByRole("link");

    expect(button).toHaveTextContent(
      "l10n string: [profile-label-upgrade-2], with vars: {}"
    );
  });

  it("displays a disabled button when a free user has reached the alias limit, and Premium is not available in their country", () => {
    render(
      <AliasGenerationButton
        aliases={[
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
        ]}
        profile={getMockProfileData({ has_premium: false })}
        onCreate={jest.fn()}
        runtimeData={getMockRuntimeDataWithoutPremium()}
      />
    );

    const button = screen.getByRole("button");

    expect(button).toBeDisabled();
  });

  it("disables the button when relevant, also if the user still has a subdomain set from a previous Premium subscription", () => {
    render(
      <AliasGenerationButton
        aliases={[
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
          getMockRandomAlias(),
        ]}
        profile={getMockProfileData({
          has_premium: false,
          subdomain: "mydomain",
        })}
        onCreate={jest.fn()}
        runtimeData={getMockRuntimeDataWithoutPremium()}
      />
    );

    const button = screen.getByRole("button");

    expect(button).toBeDisabled();
  });

  describe("with the `generateCustomAliasMenu` feature flag enabled", () => {
    it("displays a usable button to generate an alias for a Premium user over the free-user alias limit, without a subdomain set", () => {
      render(
        <AliasGenerationButton
          aliases={[
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
          ]}
          profile={getMockProfileData({ has_premium: true, subdomain: null })}
          onCreate={jest.fn()}
          runtimeData={getMockRuntimeDataWithoutPremium()}
        />
      );

      const button = screen.getByRole("button");

      expect(button).toBeEnabled();
      expect(button).toHaveTextContent(
        "l10n string: [profile-label-generate-new-alias-2], with vars: {}"
      );
    });

    it("displays a drop-down menu to generate either a random or a custom alias for a Premium user over the free-user alias limit, with a subdomain set", () => {
      const mockedConfig = mockConfigModule.getRuntimeConfig();
      // getRuntimeConfig() is called frequently, so mock its return value,
      // then restore the original mock at the end of this test:
      mockConfigModule.getRuntimeConfig.mockReturnValue({
        ...mockedConfig,
        featureFlags: {
          ...mockedConfig.featureFlags,
          generateCustomAliasMenu: true,
        },
      });
      render(
        <AliasGenerationButton
          aliases={[
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
            getMockRandomAlias(),
          ]}
          profile={getMockProfileData({
            has_premium: true,
            subdomain: "mydomain",
          })}
          onCreate={jest.fn()}
          runtimeData={getMockRuntimeDataWithoutPremium()}
        />
      );

      const dropDownButton = screen.getByRole("button");
      userEvent.click(dropDownButton);
      const menu = screen.getByRole("menu");
      const menuItems = screen.getAllByRole("menuitem");

      expect(dropDownButton).toBeEnabled();
      expect(dropDownButton).toHaveTextContent(
        "l10n string: [profile-label-generate-new-alias-2], with vars: {}"
      );
      expect(menu).toBeInTheDocument();
      expect(menuItems).toHaveLength(2);
      mockConfigModule.getRuntimeConfig.mockReturnValue(mockedConfig);
    });
  });
});
