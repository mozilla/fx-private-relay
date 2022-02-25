import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Onboarding } from "./Onboarding";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Onboarding",
  component: Onboarding,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof Onboarding>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Onboarding> = (args) => (
  <Onboarding {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  aliases: [],
};
Default.storyName = "Onboarding";
