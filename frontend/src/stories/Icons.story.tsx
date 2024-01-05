import type { Meta } from "@storybook/react";
import * as Icons from "../components/Icons";
import React from "react";

/**
 * These are the icons used in the app. They are imported from the Icons.tsx file in the components folder.
 * Each icon is a React component that takes in an alt prop and various other props as needed.
 */

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta: Meta<(typeof React.Component)[]> = {
  title: "Icons",
  component: undefined,
  // This component will have an automatically generated Autodocs entry: https://storybook.js.org/docs/writing-docs/autodocs
  tags: ["autodocs"],
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  parameters: {
    jest: ["Icons"],
  },
};

export default meta;

const containerStyles: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
};

const iconStyles: React.CSSProperties = {
  margin: "2rem", // spacing between icons
};

export const DefaultView = {
  render: (args: { width?: number; height?: number }) => {
    const RenderIcons = []; // container for all our icons

    // iterate through all icons imported from Icons.tsx
    for (const key in Icons) {
      if (Object.hasOwnProperty.call(Icons, key)) {
        const Icon = Icons[key as keyof typeof Icons];
        // add icon to our icons list to render
        RenderIcons.push(<Icon style={iconStyles} alt="" {...args} />);
      }
    }

    // render all icons
    return <div style={containerStyles}>{RenderIcons}</div>;
  },
  argTypes: {
    width: {
      control: { type: "number" },
      describe: "Width of the icon",
    },
    height: {
      control: { type: "number" },
    },
  },
};
