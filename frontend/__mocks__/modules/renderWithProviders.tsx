import React, { PropsWithChildren } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { LocalizationProvider, ReactLocalization } from "@fluent/react";
import { FluentBundle, FluentResource } from "@fluent/bundle";
import { OverlayProvider } from "react-aria";

function makeL10n(): ReactLocalization {
  const bundle = new FluentBundle("en-US");
  bundle.addResource(new FluentResource(""));
  return new ReactLocalization([bundle]);
}

function AllProviders({ children }: PropsWithChildren<{}>) {
  return (
    <OverlayProvider>
      <LocalizationProvider l10n={makeL10n()}>{children}</LocalizationProvider>
    </OverlayProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
