import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockLocalizedModule } from "../../../../__mocks__/components/Localized";
import { mockConfigModule } from "../../../../__mocks__/configMock";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";
import { CategoryFilter } from "./CategoryFilter";

jest.mock("../../../config.ts", () => mockConfigModule);
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("../../../components/Localized.tsx", () => mockLocalizedModule);

describe("<CategoryFilter>", () => {
  it.each([
    {
      userType: "premium",
      showPremiumFilters: true,
      expectedFilters: {
        custom: true,
        random: true,
        active: true,
        promoBlocking: true,
        disabled: true,
      },
    },
    {
      userType: "free",
      showPremiumFilters: false,
      expectedFilters: {
        custom: false,
        random: false,
        active: true,
        promoBlocking: false,
        disabled: true,
      },
    },
  ])(
    "shows correct filter options for $userType users",
    async ({ showPremiumFilters, expectedFilters }) => {
      render(
        <CategoryFilter
          selectedFilters={{}}
          onChange={jest.fn()}
          resetChecks={false}
          setCheckboxes={jest.fn()}
          showPremiumFilters={showPremiumFilters}
        />,
      );

      const filterButton = screen.getByRole("button", {
        name: /profile-filter-category-button-tooltip/i,
      });
      await userEvent.click(filterButton);

      await waitFor(() => {
        if (expectedFilters.custom) {
          expect(screen.getByLabelText(/custom-masks/i)).toBeInTheDocument();
        } else {
          expect(
            screen.queryByLabelText(/custom-masks/i),
          ).not.toBeInTheDocument();
        }

        if (expectedFilters.random) {
          expect(screen.getByLabelText(/random-masks/i)).toBeInTheDocument();
        } else {
          expect(
            screen.queryByLabelText(/random-masks/i),
          ).not.toBeInTheDocument();
        }

        expect(screen.getByLabelText(/active-masks/i)).toBeInTheDocument();

        if (expectedFilters.promoBlocking) {
          expect(
            screen.getByLabelText(/promo-blocking-masks/i),
          ).toBeInTheDocument();
        } else {
          expect(
            screen.queryByLabelText(/promo-blocking-masks/i),
          ).not.toBeInTheDocument();
        }

        expect(screen.getByLabelText(/disabled-masks/i)).toBeInTheDocument();
      });
    },
  );

  it("calls onChange with selected filters when Apply is clicked", async () => {
    const onChangeMock = jest.fn();
    render(
      <CategoryFilter
        selectedFilters={{}}
        onChange={onChangeMock}
        resetChecks={false}
        setCheckboxes={jest.fn()}
        showPremiumFilters={false}
      />,
    );

    const filterButton = screen.getByRole("button", {
      name: /profile-filter-category-button-tooltip/i,
    });
    await userEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/active-masks/i)).toBeInTheDocument();
    });

    const forwardingCheckbox = screen.getByLabelText(/active-masks/i);
    await userEvent.click(forwardingCheckbox);

    const applyButton = screen.getByRole("button", { name: /apply/i });
    await userEvent.click(applyButton);

    expect(onChangeMock).toHaveBeenCalledWith({
      domainType: undefined,
      status: "forwarding",
    });
  });

  it("calls onChange with reset filters when Reset is clicked", async () => {
    const onChangeMock = jest.fn();
    render(
      <CategoryFilter
        selectedFilters={{ status: "forwarding" }}
        onChange={onChangeMock}
        resetChecks={false}
        setCheckboxes={jest.fn()}
        showPremiumFilters={false}
      />,
    );

    const filterButton = screen.getByRole("button", {
      name: /profile-filter-category-button-tooltip/i,
    });
    await userEvent.click(filterButton);

    await waitFor(() => {
      expect(screen.getByLabelText(/active-masks/i)).toBeInTheDocument();
    });

    const resetButton = screen.getByRole("button", { name: /reset/i });
    await userEvent.click(resetButton);

    expect(onChangeMock).toHaveBeenCalledWith({
      domainType: undefined,
      status: undefined,
    });
  });
});
