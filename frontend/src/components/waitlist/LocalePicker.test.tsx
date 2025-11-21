import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { LocalePicker } from "./LocalePicker";

jest.mock(
  "cldr-localenames-modern/main/it/languages.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      it: {
        localeDisplayNames: {
          languages: {
            it: "italiano",
            en: "inglese",
            fr: "francese",
            zh: "cinese",
          },
        },
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  "cldr-localenames-modern/main/nl/languages.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      nl: {
        localeDisplayNames: {
          languages: {
            nl: "Nederlands",
            en: "Engels",
            fr: "Frans",
          },
        },
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  "cldr-localenames-modern/main/en/languages.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      en: {
        localeDisplayNames: {
          languages: {
            en: "English",
            de: "German",
            es: "Spanish",
          },
        },
      },
    },
  }),
  { virtual: true },
);

function setup(props?: React.ComponentProps<typeof LocalePicker>) {
  const user = userEvent.setup();
  const utils = render(
    <LocalePicker
      data-testid="locale-picker"
      supportedLocales={[]}
      {...props}
    />,
  );
  return { user, ...utils };
}

describe("LocalePicker", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("renders languages for an exact locale 'it'", async () => {
    getLocaleMock.mockReturnValue("it");
    setup({ supportedLocales: ["fr", "en", "it"] });
    await screen.findByRole("option", { name: "francese" });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["francese", "inglese", "italiano"]);
  });

  it("falls back from 'nl-NL' to truncated 'nl'", async () => {
    getLocaleMock.mockReturnValue("nl-NL");
    setup({ supportedLocales: ["nl", "fr", "en"] });
    await screen.findByRole("option", { name: "Frans" });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["Engels", "Frans", "Nederlands"]);
  });

  it("falls back to English when exact and truncated locales fail", async () => {
    getLocaleMock.mockReturnValue("xx-XX");
    setup({ supportedLocales: ["de", "es", "en"] });
    await screen.findByRole("option", { name: "English" });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["English", "German", "Spanish"]);
  });

  it("spreads props to the select and handles change", async () => {
    getLocaleMock.mockReturnValue("en");
    const handleChange = jest.fn((e) => e && e.target && e.target.value);
    const { user } = setup({
      supportedLocales: ["de", "en"],
      name: "locale",
      defaultValue: "de",
      onChange: handleChange,
      "aria-label": "Locale",
    });
    await screen.findByRole("option", { name: "English" });
    const select = screen.getByTestId("locale-picker");
    expect(select).toHaveAttribute("name", "locale");
    expect(select).toHaveAttribute("aria-label", "Locale");
    await user.selectOptions(select, "de");
    await user.selectOptions(select, "en");
    expect(handleChange).toHaveBeenCalled();
    expect((select as HTMLSelectElement).value).toBe("en");
  });
});
