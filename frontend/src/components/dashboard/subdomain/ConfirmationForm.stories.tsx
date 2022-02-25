import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { SubdomainConfirmationForm } from "./ConfirmationForm";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Subdomain/ConfirmationForm",
  component: SubdomainConfirmationForm,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "centered",
  },
} as ComponentMeta<typeof SubdomainConfirmationForm>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof SubdomainConfirmationForm> = (args) => (
  <SubdomainConfirmationForm {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  subdomain: "my-subdomain",
};
Default.storyName = "ConfirmationForm";
