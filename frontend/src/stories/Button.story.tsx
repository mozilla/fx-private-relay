import type { Meta } from "@storybook/react";
import { Button } from "../components/Button";
import { useL10n } from "../hooks/l10n";
import { Localized } from "../components/Localized";

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: "Button",
  component: Button,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["Button"],
  },
} satisfies Meta<typeof Button>;

export default meta;

export const defaultView = {
  render: (args: {
    variant: "destructive" | "secondary" | undefined;
    label: string;
  }) => <Button variant={args.variant}>{args.label ?? "Button"}</Button>,
  argTypes: {
    variant: {
      options: [undefined, "destructive", "secondary"],
      control: { type: "radio" },
    },
    label: {
      control: { type: "text" },
    },
  },
};

export const destructive = {
  render: () => {
    return (
      <Localized id="mask-deletion-header">
        <Button variant="destructive"> </Button>
      </Localized>
    );
  },
};

export const secondary = {
  render: () => <Button variant="secondary">Secondary</Button>,
};

export const disabled = {
  render: () => <Button disabled>Disabled</Button>,
};
