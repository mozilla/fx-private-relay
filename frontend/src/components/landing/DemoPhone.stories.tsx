import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { DemoPhone } from "./DemoPhone";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Landing/DemoPhone",
  component: DemoPhone,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof DemoPhone>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof DemoPhone> = (args) => (
  <DemoPhone {...args} />
);

export const Free = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Free.args = {
  premium: false,
};

export const Premium = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Premium.args = {
  premium: true,
};
