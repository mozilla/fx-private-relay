import { ReactNode, cloneElement, isValidElement } from "react";

export const mockFluentReact = {
  useLocalization: () => {
    return {
      l10n: {
        getString: (id: string, vars?: Record<string, string>) =>
          `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,
        bundles: [{ locales: "en-GB" }],
      },
    };
  },
  Localized: (props: { children: ReactNode; vars?: Record<string, string> }) =>
    isValidElement(props.children) ? (
      cloneElement(
        props.children,
        {},
        <>[Localized with vars: {JSON.stringify(props.vars ?? {})}]</>
      )
    ) : (
      <>Invalid Localized element (more than a single child element)</>
    ),
};
