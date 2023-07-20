// Imports of `useLocalization` are forbidden because the hook in this file
// should be used instead, but of course this hook can use it just fine:
// eslint-disable-next-line no-restricted-imports
import { ReactLocalization, useLocalization } from "@fluent/react";
import { createElement, Fragment, useEffect, useState } from "react";

/**
 * Equivalent to ReactLocalization.getString, but returns a React Fragment.
 *
 * This is useful because it allows you to replace tags in localised strings
 * with HTML elements, without needing to reach out to <Localized>.
 *
 * (This method got booted out of @fluent/react proper because it's so simple,
 * but it's pretty useful:
 * https://github.com/projectfluent/fluent.js/pull/595#discussion_r967011632)
 */
type GetFragment = (
  id: Parameters<ReactLocalization["getString"]>[0],
  args?: Parameters<ReactLocalization["getElement"]>[2],
  fallback?: Parameters<ReactLocalization["getString"]>[2],
) => ReturnType<ReactLocalization["getElement"]>;

type ExtendedReactLocalization = ReactLocalization & {
  getFragment: GetFragment;
};

/**
 * Wraps @fluent/react's useLocalization to be consistent between prerender and first render
 *
 * React will throw a tantrum if the HTML rendered during the build differs from
 * the DOM rendered by React when running client-side. However, at build-time we
 * don't yet know the user's locale. Thus, if we render strings in the user's
 * locale on the first client-side render, we'll make React unhappy, and who
 * wants that?
 *
 * To work around this, this hook makes sure that the English strings are
 * rendered when both prerendering and doing the first client-side render, and
 * only after that use the language that aligns with the user's preferences.
 */
export const useL10n = (): ExtendedReactLocalization => {
  const { l10n } = useLocalization();
  const [isPrerendering, setIsPrerendering] = useState(true);

  const getFragment: GetFragment = (id, args, fallback) =>
    l10n.getElement(createElement(Fragment, null, fallback ?? id), id, args);

  useEffect(() => {
    setIsPrerendering(false);
  }, []);

  if (isPrerendering) {
    const prerenderingL10n: ExtendedReactLocalization = {
      getBundle: l10n.getBundle,
      bundles: l10n.bundles,
      parseMarkup: l10n.parseMarkup,
      areBundlesEmpty: l10n.areBundlesEmpty,
      reportError: l10n.reportError,
      getString: (id, vars, fallback) => {
        const bundle = l10n.getBundle("en");
        if (bundle) {
          const message = bundle.getMessage(id);
          if (message && message.value) {
            return bundle.formatPattern(message.value, vars);
          }
        }

        return l10n.getString(id, vars, fallback);
      },
      getElement: l10n.getElement,
      getFragment: getFragment,
    };

    return prerenderingL10n;
  }

  const extendedL10n: ExtendedReactLocalization =
    l10n as ExtendedReactLocalization;
  extendedL10n.getFragment = getFragment;

  return extendedL10n;
};
