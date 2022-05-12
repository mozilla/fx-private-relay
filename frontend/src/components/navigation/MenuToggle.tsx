import { useLocalization } from "@fluent/react";
import { CloseIcon, MenuIcon } from "../Icons";

export const MenuToggle = ({ ...props }): JSX.Element => {
  const { l10n } = useLocalization();
  const { toggle } = props || false;

  const ToggleMenuOpen = () =>
    MenuIcon({
      alt: l10n.getString("menu-toggle-open"),
    });

  // We are setting the viewBox here to make sure this icon aligns with its counterpart.
  // The viewBox attribute defines the position and dimension, in user space, of an SVG viewport.
  // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
  const CloseMenu = () =>
    CloseIcon({
      alt: l10n.getString("menu-toggle-close"),
      viewBox: "3 3 16 16",
    });

  return !toggle ? <ToggleMenuOpen /> : <CloseMenu />;
};
