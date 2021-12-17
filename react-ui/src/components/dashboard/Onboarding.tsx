import { useLocalization } from "@fluent/react";
import styles from "./Onboarding.module.scss";
import IconImage from "../../../../static/images/dashboard-onboarding/onboarding-step-2.svg";
import RightClickImage from "../../../../static/images/dashboard-onboarding/onboarding-step-3.svg";
import { AliasData } from "../../hooks/api/aliases";
import { Button } from "../Button";

export type Props = {
  aliases: AliasData[];
  onCreate: () => void;
};

export const Onboarding = (props: Props) => {
  const { l10n } = useLocalization();

  if (props.aliases.length > 0) {
    return null;
  }

  return (
    <section className={styles.wrapper}>
      <h2>{l10n.getString("onboarding-headline")}</h2>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <p>{l10n.getString("onboarding-alias-tip-1")}</p>
          <div className={styles.footer}>
            <Button
              onClick={() => props.onCreate()}
              title={l10n.getString("profile-label-generate-new-alias")}
            >
              {l10n.getString("profile-label-generate-new-alias")}
            </Button>
          </div>
        </li>
        <li className={styles.step}>
          <p>{l10n.getString("onboarding-alias-tip-2")}</p>
          <div className={styles.footer}>
            <img src={IconImage.src} alt="" />
          </div>
        </li>
        <li className={styles.step}>
          <p>{l10n.getString("onboarding-alias-tip-3")}</p>
          <div className={styles.footer}>
            <img src={RightClickImage.src} alt="" />
          </div>
        </li>
      </ol>
    </section>
  );
};
