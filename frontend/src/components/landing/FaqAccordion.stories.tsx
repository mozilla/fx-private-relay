import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { Entry, FaqAccordion } from "./FaqAccordion";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Landing/FaqAccordion",
  component: FaqAccordion,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof FaqAccordion>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof FaqAccordion> = (args) => (
  <FaqAccordion {...args} />
);

const mockFaqs: Entry[] = [
  {
    q: "Question 1",
    a: (
      <span>
        Answer, <em>with markup</em> if so desired.
      </span>
    ),
  },
  {
    q: "Question 2",
    a: (
      <span>
        Answer, <em>with markup</em> if so desired.
      </span>
    ),
  },
  {
    q: "Question 3",
    a: (
      <span>
        Answer, <em>with markup</em> if so desired.
      </span>
    ),
  },
];

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  entries: mockFaqs,
};
Default.storyName = "FaqAccordion";
