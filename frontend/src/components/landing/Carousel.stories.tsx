import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";
import { INITIAL_VIEWPORTS } from "@storybook/addon-viewport";
import FavIcon from "../../../../static/images/use-case-gaming.svg";

import { Carousel, CarouselTab } from "./Carousel";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Landing/Carousel",
  component: Carousel,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "padded",
    //👇 The viewports object from the Essentials addon
    viewport: {
      //👇 The viewports you want to use
      viewports: INITIAL_VIEWPORTS,
    },
  },
} as ComponentMeta<typeof Carousel>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof Carousel> = (args) => (
  <Carousel {...args} />
);

const mockTabs: CarouselTab[] = [
  {
    color: "yellow",
    heading: "Item 1",
    content: "Text of the first tab",
    id: "item-1",
    illustration: FavIcon,
  },
  {
    color: "orange",
    heading: "Item 2",
    content: "Text of the second tab",
    id: "item-2",
    illustration: FavIcon,
  },
  {
    color: "pink",
    heading: "Item 3",
    content: "Text of the third tab",
    id: "item-3",
    illustration: FavIcon,
  },
  {
    color: "red",
    heading: "Item 4",
    content: "Text of the fourth tab",
    id: "item-4",
    illustration: FavIcon,
  },
  {
    color: "teal",
    heading: "Item 5",
    content: "Text of the fifth tab",
    id: "item-5",
    illustration: FavIcon,
  },
];

export const Default = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
Default.args = {
  title: "Describe the Carousel for users of screen readers",
  tabs: mockTabs,
};

export const SmallScreen = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
SmallScreen.args = {
  title: "Describe the Carousel for users of screen readers",
  tabs: mockTabs,
};
SmallScreen.parameters = {
  viewport: {
    defaultViewport: "iphone6",
  },
};
