import { cloneElement, isValidElement, ReactNode } from "react";

export const mockLocalizedModule = {
  Localized: (props: {
    children: ReactNode;
    id: string;
    vars?: Record<string, string>;
  }) =>
    isValidElement(props.children) ? (
      cloneElement(
        props.children,
        {},
        <>
          [&lt;Localized&gt; with id [{props.id}] and vars:{" "}
          {JSON.stringify(props.vars ?? {})}]
        </>
      )
    ) : (
      <>Invalid Localized element (more than a single child element)</>
    ),
};
