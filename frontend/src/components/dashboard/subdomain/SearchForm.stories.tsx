import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { SubdomainSearchForm } from "./SearchForm";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Subdomain/SearchForm",
  component: SubdomainSearchForm,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof SubdomainSearchForm>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof SubdomainSearchForm> = (args) => (
  <SubdomainSearchForm {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {};
Default.storyName = "SearchForm";
