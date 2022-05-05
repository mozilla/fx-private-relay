import { useState } from "react";
import { useLocalization } from "@fluent/react";
import styles from "./MenuToggle.module.scss";
import { CloseIcon, MenuIcon } from "../Icons";

export const MenuToggle = ({ ...props }): JSX.Element => {
  const [isToggle, setToggle] = useState(false);
  const { l10n } = useLocalization();

  const ToggleMenuOpen = () =>
    MenuIcon({
      alt: l10n.getString("menu-toggle-open"),
      className: `${styles["mobile-menu-toggle"]}`,
    });

  const CloseMenu = () =>
    CloseIcon({
      alt: l10n.getString("menu-toggle-close"),
      className: `${styles["mobile-menu-close"]}`,
    });

  const handleToggle = () => {
    setToggle(!isToggle);
  };

  return (
    <a
      href="#"
      className={`${styles["menu-toggle"]} ${isToggle ? "-active" : ""}`}
      role="menuitem"
      aria-controls="mobile-menu"
      aria-expanded={isToggle}
      onClick={handleToggle}
    >
      {!isToggle && <ToggleMenuOpen />}
      {isToggle && <CloseMenu />}
    </a>
  );
};
