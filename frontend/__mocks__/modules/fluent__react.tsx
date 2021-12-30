import { ReactNode } from "react";

export const mockFluentReact = {
  useLocalization: () => {
    return {
      l10n: {
        getString: (id: string, vars?: Record<string, string>) => `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,
      },
    };
  },
  Localized: (props: {
    children: ReactNode;
    vars?: Record<string, string>;
  }) => (
    <>
      [Localized with vars: {JSON.stringify(props.vars ?? {})}] {props.children}
    </>
  ),
};
