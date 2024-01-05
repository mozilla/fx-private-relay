import type { Meta } from "@storybook/react";
import { CountdownTimer } from "../components/CountdownTimer";

/** 
 * 
 * This code snippet defines a React component named `CountdownTimer`, which serves as a customizable digital countdown display. The component takes a single prop, remainingTimeInMs, 
 * representing the time left in milliseconds. It utilizes a localization hook, useL10n, to support internationalization, ensuring that the timer's display is adapted to different languages and locales.
 * 
 * The core functionality is in the getRemainingTimeParts function, which calculates the days, hours, minutes, and seconds remaining from the given milliseconds. These calculated values are then rendered in a structured layout using HTML elements (`figure`, `time`, `dl`, `dt`, and `dd`), with class styling applied from the imported CountdownTimer.module.scss for customizable CSS styling.

 * The component's UI is designed to be accessible, with appropriate aria-label attributes for screen readers and semantic HTML tags. This makes the countdown timer not just visually appealing but also usable by a diverse range of users, including those relying on assistive technologies.
 */

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<typeof CountdownTimer> = {
  title: "CountdownTimer",
  component: CountdownTimer,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["CountdownTimer"],
  },
};

export default meta;

export const DefaultView = {
  render: (args: { remainingTimeInMs: number }) => (
    <CountdownTimer remainingTimeInMs={args.remainingTimeInMs || 21075042} />
  ),
  argTypes: {
    remainingTimeInMs: {
      control: { type: "number" },
    },
  },
};
