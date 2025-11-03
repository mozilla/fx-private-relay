import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CountryPicker } from "./CountryPicker";

jest.mock(
  "cldr-localenames-modern/main/it/territories.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      it: {
        localeDisplayNames: {
          territories: {
            IT: "Italia",
            FR: "Francia",
            "150": "Europa",
          },
        },
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  "cldr-localenames-modern/main/nl/territories.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      nl: {
        localeDisplayNames: {
          territories: {
            NL: "Nederland",
            BE: "België",
            "001": "Wereld",
          },
        },
      },
    },
  }),
  { virtual: true },
);

jest.mock(
  "cldr-localenames-modern/main/en/territories.json",
  () => ({
    __esModule: true,
    default: undefined,
    main: {
      en: {
        localeDisplayNames: {
          territories: {
            US: "United States",
            CA: "Canada",
            "001": "World",
          },
        },
      },
    },
  }),
  { virtual: true },
);

function setup(props?: React.ComponentProps<typeof CountryPicker>) {
  const user = userEvent.setup();
  const utils = render(
    <CountryPicker data-testid="country-picker" {...props} />,
  );
  return { user, ...utils };
}

describe("CountryPicker", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("renders countries for a locale that exists exactly (no fallback) — 'it'", async () => {
    getLocaleMock.mockReturnValue("it");

    setup();

    const optionItalia = await screen.findByRole("option", { name: "Italia" });
    const optionFrancia = screen.getByRole("option", { name: "Francia" });

    expect(optionItalia).toBeInTheDocument();
    expect(optionFrancia).toBeInTheDocument();

    expect(
      screen.queryByRole("option", { name: "Europa" }),
    ).not.toBeInTheDocument();

    const allOptions = screen.getAllByRole("option").map((o) => o.textContent);
    expect(allOptions).toEqual(["Francia", "Italia"]);
  });

  it("falls back from 'nl-NL' to truncated 'nl' when full locale is missing", async () => {
    getLocaleMock.mockReturnValue("nl-NL");

    setup();

    const optionBE = await screen.findByRole("option", { name: "België" });
    const optionNL = screen.getByRole("option", { name: "Nederland" });
    expect(optionBE).toBeInTheDocument();
    expect(optionNL).toBeInTheDocument();

    expect(
      screen.queryByRole("option", { name: "Wereld" }),
    ).not.toBeInTheDocument();

    const allOptions = screen.getAllByRole("option").map((o) => o.textContent);
    expect(allOptions).toEqual(["België", "Nederland"]);
  });

  it("falls back to English when both exact and truncated locale imports fail", async () => {
    getLocaleMock.mockReturnValue("xx-XX");

    setup();

    const optionUS = await screen.findByRole("option", {
      name: "United States",
    });
    const optionCA = screen.getByRole("option", { name: "Canada" });
    expect(optionUS).toBeInTheDocument();
    expect(optionCA).toBeInTheDocument();

    expect(
      screen.queryByRole("option", { name: "World" }),
    ).not.toBeInTheDocument();

    const allOptions = screen.getAllByRole("option").map((o) => o.textContent);
    expect(allOptions).toEqual(["Canada", "United States"]);
  });

  it("spreads props to the underlying <select> and fires onChange", async () => {
    getLocaleMock.mockReturnValue("en");

    const handleChange = jest.fn((e) => e && e.target && e.target.value);

    const { user } = setup({
      name: "country",
      defaultValue: "CA",
      onChange: handleChange,
      "aria-label": "Country",
    });

    await screen.findByRole("option", { name: "United States" });
    const select = screen.getByTestId("country-picker");

    expect(select).toHaveAttribute("name", "country");
    expect(select).toHaveAttribute("aria-label", "Country");
    expect((select as HTMLSelectElement).value).toBe("CA");

    await user.selectOptions(select, "US");
    expect(handleChange).toHaveBeenCalled();
    expect((select as HTMLSelectElement).value).toBe("US");
  });
});
