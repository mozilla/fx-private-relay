export const mockUseL10nModule = {
  useL10n: () => {
    return {
      getString: (id: string, vars?: Record<string, string>) =>
        `l10n string: [${id}], with vars: ${JSON.stringify(vars ?? {})}`,
      bundles: [{ locales: ["en-GB"] }],
    };
  },
};
