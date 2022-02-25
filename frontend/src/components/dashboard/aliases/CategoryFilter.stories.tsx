import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { CategoryFilter } from "./CategoryFilter";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Aliases/CategoryFilter",
  component: CategoryFilter,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof CategoryFilter>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CategoryFilter> = (args) => (
  <CategoryFilter {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  selectedFilters: {},
};
Default.storyName = "CategoryFilter";
