import { useLocalization } from "@fluent/react";
import { getRuntimeConfig } from "../../config";
import { event as gaEvent } from "react-ga";
import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../hooks/gaViewPing";

export const UpgradeButton = ({ ...props }): JSX.Element => {
  const { l10n } = useLocalization();
  const upgradeButtonRef = useGaViewPing({
    category: "Upgrade",
    label: "profile-upgrade",
  });

  return (
    <a
      href={getRuntimeConfig().upgradeUrl}
      ref={upgradeButtonRef}
      onClick={() =>
        gaEvent({
          category: "Upgrade",
          action: "Engage",
          label: "profile-upgrade",
        })
      }
      className={`btn ${styles["upgrade-button"]}`}
    >
      {l10n.getString("menu-upgrade-button")}
    </a>
  );
};
