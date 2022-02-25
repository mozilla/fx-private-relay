import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { AppPicker } from "./AppPicker";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Layout/AppPicker",
  component: AppPicker,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "centered",
  },
} as ComponentMeta<typeof AppPicker>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof AppPicker> = (args) => (
  <AppPicker {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  theme: "premium",
};
Default.storyName = "AppPicker";
