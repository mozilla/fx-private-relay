import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { SubdomainIndicator } from "./SubdomainIndicator";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Subdomain/SubdomainIndicator",
  component: SubdomainIndicator,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof SubdomainIndicator>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof SubdomainIndicator> = (args) => (
  <SubdomainIndicator {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  subdomain: "my-subdomain",
};
Default.storyName = "SubdomainIndicator";
