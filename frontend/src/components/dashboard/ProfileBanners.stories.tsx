import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { ProfileBanners } from "./ProfileBanners";
import { ProfileData } from "../../hooks/api/profile";
import { UserData } from "../../hooks/api/user";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/ProfileBanners",
  component: ProfileBanners,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof ProfileBanners>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof ProfileBanners> = (args) => (
  <ProfileBanners {...args} />
);

const profileData = {
  has_premium: true,
  subdomain: "my-subdomain",
  bounce_status: [false, ""],
  next_email_try: "2042-01-01T00:00:00.000Z",
} as ProfileData;

const userData = {
  email: "someone@example.com",
} as UserData;

export const AllSet = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
AllSet.args = {
  profile: profileData,
};

export const WithSoftBounce = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithSoftBounce.args = {
  profile: {
    ...profileData,
    bounce_status: [true, "soft"],
  },
  user: userData,
};

export const WithHardBounce = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithHardBounce.args = {
  profile: {
    ...profileData,
    bounce_status: [true, "hard"],
  },
  user: userData,
};

export const WithoutSubdomain = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithoutSubdomain.args = {
  profile: {
    ...profileData,
    subdomain: null,
  },
};

export const WithoutPremium = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithoutPremium.args = {
  profile: {
    ...profileData,
    has_premium: false,
  },
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

export const MaximumBanners = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
MaximumBanners.args = {
  profile: {
    ...profileData,
    subdomain: null,
    bounce_status: [true, "hard"],
  },
  user: userData,
};
