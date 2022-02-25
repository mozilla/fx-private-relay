import React from "react";
import { ComponentStory, ComponentMeta } from "@storybook/react";

import { SubdomainConfirmationModal } from "./ConfirmationModal";

// More on default export: https://storybook.js.org/docs/react/writing-stories/introduction#default-export
export default {
  title: "Dashboard/Subdomain/ConfirmationModal",
  component: SubdomainConfirmationModal,
  parameters: {
    // More on Story layout: https://storybook.js.org/docs/react/configure/story-layout
    layout: "centered",
  },
} as ComponentMeta<typeof SubdomainConfirmationModal>;

// More on component templates: https://storybook.js.org/docs/react/writing-stories/introduction#using-args
const Template: ComponentStory<typeof SubdomainConfirmationModal> = (args) => (
  <SubdomainConfirmationModal {...args} />
);

export const ConfirmationForm = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
ConfirmationForm.args = {
  subdomain: "my-subdomain",
  isOpen: true,
  isSet: false,
};

export const SuccessMessage = Template.bind({});
// More on args: https://storybook.js.org/docs/react/writing-stories/args
SuccessMessage.args = {
  subdomain: "my-subdomain",
  isOpen: true,
  isSet: true,
};
