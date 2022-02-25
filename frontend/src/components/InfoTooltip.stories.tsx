import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { InfoTooltip } from "./InfoTooltip";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "General/InfoTooltip",
  component: InfoTooltip,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof InfoTooltip>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof InfoTooltip> = (args) => (
  <InfoTooltip {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  alt: "Alt text for the icon that can be hovered",
  children: (
    <span>
      Child elements are shown inside the tooltip on hover, and can include{" "}
      <b>markup</b>!
    </span>
  ),
};
Default.storyName = "InfoTooltip";
