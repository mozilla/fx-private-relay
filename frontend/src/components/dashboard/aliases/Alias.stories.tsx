import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Alias } from "./Alias";
import { CustomAliasData } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { UserData } from "../../../hooks/api/user";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Aliases/Alias",
  component: Alias,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof Alias>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Alias> = (args) => <Alias {...args} />;

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

const userData = {
  email: "arbitrary@example.com",
} as UserData;

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  alias: aliasData,
  profile: profileData,
  user: userData,
};

export const Expanded = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Expanded.args = {
  alias: aliasData,
  profile: profileData,
  defaultOpen: true,
  user: userData,
};

export const BlockingAll = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
BlockingAll.args = {
  alias: {
    ...aliasData,
    enabled: false,
  },
  profile: profileData,
  user: userData,
};
