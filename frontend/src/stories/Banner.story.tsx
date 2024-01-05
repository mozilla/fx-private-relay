import type { Meta } from "@storybook/react";
import { Banner, BannerProps } from "../components/Banner"; 

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<typeof Banner> = {
  title: "Banner",
  component: Banner,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["Banner"],
    stringName: "",
  },
};

export default meta;
 
export const DefaultView = {
  render: (args: BannerProps) => (
    <Banner type={args.type ?? "info"} title={args.title ?? "Banner title"}>
      {args.children ?? "Banner content"}
    </Banner>
  ),
  argTypes: {
    type: {
      options: ["warning", "info", "promo"], 
      control: { type: 'select' },
    },
  },
};
