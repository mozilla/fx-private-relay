import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import PremiumPromoPage from "./premium.page";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Pages/Premium Promo",
  component: PremiumPromoPage,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "fullscreen",
  },
} as ComponentMeta<typeof PremiumPromoPage>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof PremiumPromoPage> = (args) => (
  <PremiumPromoPage {...args} />
);

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {};
Default.storyName = "Premium Promo";
