import { FluentBundle, FluentResource } from "@fluent/bundle";
import { negotiateLanguages } from "@fluent/langneg";
import { MarkupParser, ReactLocalization } from "@fluent/react";

/**
 * @returns Initialise `@fluent/react`.
 * @todo Get the relevant .ftl injected by the server.
 */
export function getL10n() {
  // Store all translations as a simple object which is available
  // synchronously and bundled with the rest of the code.
  // Also, `require` isn't usually valid JS, so skip type checking for that:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translationsContext = (require as any).context(
    "../../../privaterelay/locales",
    true,
    /\.ftl$/
  );
  const RESOURCES: Record<string, FluentResource> = {};

  for (const fileName of translationsContext.keys()) {
    const locale = fileName.substring(
      "./".length,
      fileName.length - "/app.ftl".length
    );

    if (locale) {
      RESOURCES[locale] = new FluentResource(translationsContext(fileName));
    }
  }

  // A generator function responsible for building the sequence
  // of FluentBundle instances in the order of user's language
  // preferences.
  function* generateBundles(userLocales: typeof navigator.languages) {
    // Choose locales that are best for the user.
    const currentLocales = negotiateLanguages(
      userLocales as string[],
      Object.keys(RESOURCES),
      { defaultLocale: "en" }
    );

    for (const locale of currentLocales) {
      if (typeof RESOURCES[locale] === "undefined") {
        throw new Error(
          `Locale [${locale}] not found. You might want to run \`git submodule update --remote\` at the root of this repository?`
        );
      }
      const bundle = new FluentBundle(locale);
      bundle.addResource(RESOURCES[locale]);
      if (locale === "en") {
        // `require` isn't usually valid JS, so skip type checking for that:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pendingTranslations = (require as any)(
          "../../pendingTranslations.ftl"
        );
        const pendingTranslationsResource = new FluentResource(
          pendingTranslations
        );
        bundle.addResource(pendingTranslationsResource);
        if (process.env.NEXT_PUBLIC_DEBUG === "true") {
          const pendingTranslationsIds = pendingTranslationsResource.body.map(
            (stringData) => stringData.id
          );
          const mergedEnglishTranslationIds = RESOURCES.en.body.map(
            (stringData) => stringData.id
          );
          const unmergedStrings = pendingTranslationsIds.filter(
            (id) => !mergedEnglishTranslationIds.includes(id)
          );
          if (unmergedStrings.length > 0) {
            console.warn(
              "The following strings have not yet been merged into the l10n repository, and thus cannot be translated yet:",
              unmergedStrings
            );
          }
        }
      }
      yield bundle;
    }
  }

  // To enable server-side rendering, all tags are converted to plain text nodes.
  // They will be upgraded to regular HTML elements in the browser:
  const parseMarkup: MarkupParser | undefined =
    typeof document === "undefined"
      ? (str: string) => [
          {
            nodeName: "#text",
            textContent: str.replace(/<(.*?)>/g, ""),
          } as Node,
        ]
      : undefined;

  // The ReactLocalization instance stores and caches the sequence of generated
  // bundles. You can store it in your app's state.
  const l10n = new ReactLocalization(
    generateBundles(
      typeof navigator !== "undefined" ? navigator.languages : []
    ),
    parseMarkup
  );
  return l10n;
}
