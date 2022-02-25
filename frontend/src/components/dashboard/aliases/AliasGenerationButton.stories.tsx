import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { AliasGenerationButton } from "./AliasGenerationButton";
import { CustomAliasData } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Aliases/GenerationButton",
  component: AliasGenerationButton,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof AliasGenerationButton>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof AliasGenerationButton> = (args) => (
  <AliasGenerationButton {...args} />
);

const aliasData = {
  address: "some_address",
  created_at: "1970-01-01T00:00:00.000Z",
  description: "",
  domain: 2,
  enabled: true,
  id: 42,
  num_blocked: 1337,
  num_forwarded: 42,
  num_spam: 0,
  type: "custom",
} as CustomAliasData;

const profileData = {
  has_premium: true,
  subdomain: "my-subdomain",
} as ProfileData;

export const FreeUnderLimit = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
FreeUnderLimit.args = {
  aliases: [aliasData],
  profile: { has_premium: false } as ProfileData,
};
FreeUnderLimit.storyName = "Free account";

export const FreeAtLimit = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
FreeAtLimit.args = {
  aliases: [aliasData, aliasData, aliasData, aliasData, aliasData],
  profile: { has_premium: false } as ProfileData,
};
FreeAtLimit.storyName =
  "Free account, with aliases maxed out and Premium unavailable";

export const FreeAtLimitWithPremium = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
FreeAtLimitWithPremium.args = {
  aliases: [aliasData, aliasData, aliasData, aliasData, aliasData],
  profile: { has_premium: false } as ProfileData,
  runtimeData: {
    PREMIUM_PLANS: {
      country_code: "nl",
      plan_country_lang_mapping: {
        nl: {
          nl: {
            id: "price_1JmROfJNcmPzuWtR6od8OfDW",
            price: "€0,99",
          },
        },
      },
      premium_countries: ["nl"],
      premium_available_in_country: true,
    },
  } as never,
};
FreeAtLimitWithPremium.storyName =
  "Free account, with aliases maxed out and Premium unavailable";

export const Premium = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Premium.args = {
  aliases: [aliasData],
  profile: profileData,
};
