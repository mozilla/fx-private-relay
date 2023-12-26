import type { Meta } from "@storybook/react";
import { Button } from "../components/Button";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<typeof Button> = {
  title: "Button",
  component: Button,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["Button"],
    // This passes the l10n string ID to the story so that it can be localized
    // It can be passed here or story level and label argType will not override it
    stringName: "",
  },
};

export default meta;

export const DefaultView = {
  render: (args: {
    variant: "destructive" | "secondary" | undefined;
    label: string;
    disabled: boolean;
  }) => (
    <Button variant={args.variant} disabled={args.disabled}>
      {args.label ?? "Button"}
    </Button>
  ),
  argTypes: {
    variant: {
      options: [undefined, "destructive", "secondary"],
      control: { type: "radio" },
    },
    label: {
      control: { type: "text" },
    },
    disabled: {
      control: { type: "boolean" },
    },
  },
};

export const Destructive = {
  args: {
    variant: "destructive",
    children: "Remove mask",
  },
  parameters: {
    stringName: "mask-deletion-header",
  },
};

export const Secondary = {
  args: {
    variant: "secondary",
    children: "Confirm",
  },
};

export const Disabled = {
  args: {
    children: "Button",
    disabled: true,
  },
};
