import { useLocalization } from "@fluent/react";
import styles from "./UpgradeButton.module.scss";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import Link from "next/link";

export const UpgradeButton = (): JSX.Element => {
  const { l10n } = useLocalization();
  const upgradeButtonRef = useGaViewPing({
    category: "Purchase Button",
    label: "navbar-upgrade-button",
  });

  return (
    <Link href="/premium#pricing">
      <a ref={upgradeButtonRef} id={styles["upgrade-button"]}>
        {l10n.getString("menu-upgrade-button")}
      </a>
    </Link>
  );
};
