export const mockFluentReact = {
    useLocalization: () => {
        return {
            l10n: {
                getString: (id: string) => `l10n string: [${id}]`,
            },
        };
    },
};
