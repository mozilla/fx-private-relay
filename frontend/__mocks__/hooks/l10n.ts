export const mockUseL10nModule = {
  useL10n: () => {
    return {
      getString: (id: string, vars?: Record<string, string>) =>
        `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,

      getFragment: (
        id: string,
        options?: { vars?: Record<string, string> },
      ) => {
        return `fragment: [${id}], with vars: ${JSON.stringify(options?.vars ?? {})}`;
      },

      bundles: [{ locales: ["en-GB"] }],
    };
  },
};
