// import { ReactNode } from "react";
import styles from "./ErrorGeneral.module.scss";
import { useL10n } from "../../hooks/l10n";

export const ErrorGeneral = () => {
  const l10n = useL10n();
  const headingText = l10n.getString("error-general").split(". ")[0];
  const descriptionText = l10n.getString("error-general").split(". ")[1];
  return (
    <div className={styles["error-general"]}>
      <h1>{headingText}</h1>
      <p>{descriptionText}</p>
    </div>
  );
};
