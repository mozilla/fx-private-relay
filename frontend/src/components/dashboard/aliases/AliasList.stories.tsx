import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { CustomAliasData, RandomAliasData } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { AliasList } from "./AliasList";
import { UserData } from "../../../hooks/api/user";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Aliases/AliasList",
  component: AliasList,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    // layout: "fullscreen",
  },
} as ComponentMeta<typeof AliasList>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof AliasList> = (args) => (
  <AliasList {...args} />
);

const customAliasData = {
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
const randomAliasData = {
  ...customAliasData,
  type: "random",
  domain: 1,
  generated_for: "",
} as RandomAliasData;

const profileData = {
  has_premium: true,
  subdomain: "my-subdomain",
} as ProfileData;

const userData = {
  email: "arbitrary@example.com",
} as UserData;

export const Empty = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Empty.args = {
  aliases: [],
  profile: profileData,
  user: userData,
};

export const OneAlias = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
OneAlias.args = {
  aliases: [customAliasData],
  profile: profileData,
  user: userData,
};

export const SeveralAliases = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
SeveralAliases.args = {
  aliases: [
    {
      ...randomAliasData,
      enabled: false,
    },
    customAliasData,
    {
      ...customAliasData,
      enabled: false,
    },
    customAliasData,
    randomAliasData,
  ],
  profile: profileData,
  user: userData,
};
