import { ReactLocalization } from "@fluent/react";
import humanId from "human-id";
import { getLocale } from "./getLocale";

export function suggestAddress(l10n: ReactLocalization): string {
  if (getLocale(l10n).split("-")[0] === "en") {
    return humanId({ capitalize: false, separator: "-" });
  }

  return "";
}
