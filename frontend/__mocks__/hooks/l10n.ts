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

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches the `[message-id]` marker our l10n mock emits inside strings like:
 * "l10n string: [some-id], with vars: {...}"
 *
 * Use in getByText(...) or in accessible name matchers (getByRole(..., { name: ... }))
 * when the test uses the shared mockUseL10nModule.
 *
 * @param id message id (without brackets)
 * @param opts.exact If true, anchors the regex to only `[id]` (rarely needed)
 */
export const byMsgId = (id: string, opts?: { exact?: boolean }) => {
  const core = `\\[${escapeRe(id)}\\]`;
  return new RegExp(opts?.exact ? `^${core}$` : core, "i");
};

/** Alias for clarity when used specifically in accessible-name matchers */
export const byMsgIdName = byMsgId;
