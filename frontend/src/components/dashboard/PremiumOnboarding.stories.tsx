import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { PremiumOnboarding } from "./PremiumOnboarding";
import { ProfileData } from "../../hooks/api/profile";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/PremiumOnboarding",
  component: PremiumOnboarding,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "fullscreen",
  },
} as ComponentMeta<typeof PremiumOnboarding>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof PremiumOnboarding> = (args) => (
  <PremiumOnboarding {...args} />
);

const profileData = {
  has_premium: true,
  onboarding_state: 0,
} as ProfileData;

export const Step1 = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Step1.args = {
  profile: profileData,
};

export const Step2 = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Step2.args = {
  profile: {
    ...profileData,
    onboarding_state: 1,
  },
};

export const Step2WithSubdomain = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Step2WithSubdomain.args = {
  profile: {
    ...profileData,
    onboarding_state: 1,
    subdomain: "my-chosen-subdomain",
  },
};

export const Step3 = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Step3.args = {
  profile: {
    ...profileData,
    onboarding_state: 2,
  },
};
