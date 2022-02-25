import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { CsatSurvey } from "./CsatSurvey";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Layout/CsatSurvey",
  component: CsatSurvey,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
  },
} as ComponentMeta<typeof CsatSurvey>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof CsatSurvey> = (args) => (
  <CsatSurvey {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  profile: {
    id: 42,
    has_premium: true,
    date_subscribed: "1970-01-01T00:00:00.000Z",
  } as never,
};
Default.storyName = "CsatSurvey";
