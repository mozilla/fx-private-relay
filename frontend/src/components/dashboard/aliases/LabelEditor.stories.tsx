import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { LabelEditor } from "./LabelEditor";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Aliases/LabelEditor",
  component: LabelEditor,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof LabelEditor>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof LabelEditor> = (args) => (
  <LabelEditor {...args} />
);

export const WithoutLabel = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithoutLabel.args = {
  label: "",
};
WithoutLabel.storyName = "Without an existing label";

export const WithLabel = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
WithLabel.args = {
  label: "An existing label",
};
WithLabel.storyName = "With an existing label";
