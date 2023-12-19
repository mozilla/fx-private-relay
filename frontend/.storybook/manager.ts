import { addons } from "@storybook/manager-api";
import { themes } from "@storybook/theming";
import relay from "./relay";

addons.setConfig({
  theme: relay,
});
