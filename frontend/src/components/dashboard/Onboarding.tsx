import styles from "./Onboarding.module.scss";
import IconImage from "./images/onboarding-step-2.svg";
import RightClickImage from "./images/onboarding-step-3.svg";
import { AliasData } from "../../hooks/api/aliases";
import { Button } from "../Button";
import { useL10n } from "../../hooks/l10n";

export type Props = {
  aliases: AliasData[];
  onCreate: () => void;
};

/**
 * Shows the user instructions on how to use Relay if they don't have aliases yet.
 */
export const Onboarding = (props: Props) => {
  const l10n = useL10n();

  if (props.aliases.length > 0) {
    return null;
  }

  return (
    <section className={styles.wrapper}>
      <h2>{l10n.getString("onboarding-headline-2")}</h2>
      <ol className={styles.steps}>
        <li className={styles.step}>
          <p>{l10n.getString("onboarding-alias-tip-1-2")}</p>
          <div className={styles.footer}>
            <Button
              onClick={() => props.onCreate()}
              title={l10n.getString("profile-label-generate-new-alias-2")}
            >
              {l10n.getString("profile-label-generate-new-alias-2")}
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
          <p>{l10n.getString("onboarding-alias-tip-3-2")}</p>
          <div className={styles.footer}>
            <img src={RightClickImage.src} alt="" />
          </div>
        </li>
      </ol>
    </section>
  );
};
