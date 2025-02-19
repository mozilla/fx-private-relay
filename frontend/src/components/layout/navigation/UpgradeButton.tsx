import React from "react";
import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import Link from "next/link";
import { useGaEvent } from "../../../hooks/gaEvent";
import { useL10n } from "../../../hooks/l10n";

export const UpgradeButton = (): React.JSX.Element => {
  const l10n = useL10n();
  const upgradeButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "navbar-upgrade-button",
  });
  const gaEvent = useGaEvent();

  return (
    <Link
      href="/premium#pricing"
      ref={upgradeButtonRef}
      id={styles["upgrade-button"]}
      onClick={() => {
        gaEvent({
          category: "Purchase Button",
          action: "Engage",
          label: "navbar-upgrade-button",
        });
      }}
    >
      {l10n.getString("menu-upgrade-button")}
    </Link>
  );
};
