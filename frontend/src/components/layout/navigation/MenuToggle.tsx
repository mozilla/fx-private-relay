import { useLocalization } from "@fluent/react";
import { CloseIcon, MenuIcon } from "../../Icons";

export type Props = {
  toggleState: boolean | undefined;
};

export const MenuToggle = (props: Props): JSX.Element => {
  const { l10n } = useLocalization();
  const { toggleState } = props;

  const closeMenuIcon = (
    // We are setting the viewBox here to make sure this icon aligns with its counterpart.
    // The viewBox attribute defines the position and dimension, in user space, of an SVG viewport.
    // https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/viewBox
    <CloseIcon alt={l10n.getString("menu-toggle-close")} viewBox="3 3 16 16" />
  );

  const openMenuIcon = <MenuIcon alt={l10n.getString("menu-toggle-open")} />;

  return <div>{toggleState ? closeMenuIcon : openMenuIcon}</div>;
};
