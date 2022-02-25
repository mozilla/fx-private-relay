import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Plans } from "./Plans";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Landing/Plans",
  component: Plans,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof Plans>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Plans> = (args) => <Plans {...args} />;

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  premiumCountriesData: {
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
Default.storyName = "Plans";
