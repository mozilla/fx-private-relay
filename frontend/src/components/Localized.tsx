// Imports of `Localized` from @fluent/react are forbidden because the component
// in this file should be used instead, but of course this component can use it
// just fine:
// eslint-disable-next-line no-restricted-imports
import { LocalizedProps, Localized as OriginalLocalized } from "@fluent/react";
import { cloneElement, isValidElement, useEffect, useState } from "react";
import { useL10n } from "../hooks/l10n";

/**
 * Wraps @fluent/react's Localized to be consistent between prerender and first render
 *
 * React will throw a tantrum if the HTML rendered during the build differs from
 * the DOM rendered by React when running client-side. However, at build-time we
 * don't yet know the user's locale. Thus, if we render strings in the user's
 * locale on the first client-side render, we'll make React unhappy, and who
 * wants that?
 *
 * To work around this, the useL10n hook makes sure that the English strings are
 * rendered when both prerendering and doing the first client-side render, and
 * only after that use the language that aligns with the user's preferences.
 * Thus, while pre-rendering and during the first client-side render, we call
 * out to that hook.
 *
 * This means tags embedded in the localised strings won't get added initially,
 * but since that's only for SEO and the initial render, that's acceptable.
 */
export const Localized = (props: LocalizedProps) => {
  const [isPrerendering, setIsPrerendering] = useState(true);
  const l10n = useL10n();

  useEffect(() => {
    setIsPrerendering(false);
  }, []);

  if (isPrerendering) {
    // `useL10n` makes sure that this is a prerenderable string
    return isValidElement(props.children) ? (
      cloneElement(
        props.children,
        {},
        <>{l10n.getString(props.id, props.vars)}</>
      )
    ) : (
      <>{l10n.getString(props.id, props.vars)}</>
    );
  }

  return <OriginalLocalized {...props} />;
};
