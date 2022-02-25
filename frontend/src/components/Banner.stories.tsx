import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";
import { action } from "@storybook/addon-actions";
import FavIcon from "../../public/favicon.svg";

import { Banner } from "./Banner";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "General/Banner",
  component: Banner,
} as ComponentMeta<typeof Banner>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Banner> = (args) => <Banner {...args} />;

export const Warning = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Warning.args = {
  type: "warning",
  title: "A warning message",
  children: "This is a warning message",
};

export const Promo = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Promo.args = {
  type: "promo",
  title: "A promotional banner",
  children: "This is a promotional banner",
  illustration: <img src={FavIcon.src} alt="" />,
};

export const PromoWithCta = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
PromoWithCta.args = {
  type: "promo",
  title: "A promotional banner",
  children: "This is a promotional banner",
  illustration: <img src={FavIcon.src} alt="" />,
  cta: {
    content: "A Call To Action",
    target: "https://example.com",
    onClick: action("clicked-cta"),
  },
};
