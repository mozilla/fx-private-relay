import { addons } from "@storybook/manager-api";
import relay from "./relay";

addons.setConfig({
  theme: relay,
});
