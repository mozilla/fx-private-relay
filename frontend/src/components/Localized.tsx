import { LocalizedProps, Localized as OriginalLocalized } from "@fluent/react";

export const Localized = (props: LocalizedProps) => {
  return <OriginalLocalized {...props} />;
};
