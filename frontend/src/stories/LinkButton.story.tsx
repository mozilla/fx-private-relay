import type { Meta } from "@storybook/react";
import { LinkButton } from "../components/Button";

/**
 * The `LinkButton` component is used to create links that look like buttons.
 * `LinkButton` is specifically for navigation to external pages or routes.
 *
 * Note: This component is wrapped in a forwardRef so that we can get access to the actual button * element in the DOM and send events when it is scrolled into view using `useGaViewPing` hook.
 */

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<typeof LinkButton> = {
  title: "LinkButton",
  component: LinkButton,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["LinkButton"],
  },
};

export default meta;

export const DefaultView = {
  render: (args: { href: string; label: string; disabled: boolean }) => (
    <LinkButton href={args.href}>{args.label ?? "LinkButton"}</LinkButton>
  ),
  argTypes: {
    href: {
      control: { type: "text" },
      description: "URL to external page or route",
    },
    label: {
      control: { type: "text" },
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
};
