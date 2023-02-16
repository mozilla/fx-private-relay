import { useL10n } from "../../hooks/l10n";
import CreateUnlimitedEmailMasksImage from "./images/highlighted-features/features-unlimited-email-masks.svg";
import CreateMasksOnTheGoImage from "./images/highlighted-features/features-instantly-masks-on-the-go.svg";
import ReplyToEmailsAnonymouslyImage from "./images/highlighted-features/features-reply-to-emails-anon.svg";
import BlockPromotionalEmailsImage from "./images/highlighted-features/features-block-promotional-emails.svg";
import RemoveEmailTrackersImage from "./images/highlighted-features/features-remove-email-trackers.svg";

import Image, { StaticImageData } from "next/image";
import styles from "./HighlightedFeatures.module.scss";
import { LinkButton } from "../Button";

type HighlightedItemProps = {
  image: StaticImageData;
  name: string;
  isNew?: boolean;
};

export const HighlightedFeatures = () => {
  const l10n = useL10n();

  const HighlightedItem = (props: HighlightedItemProps) => {
    const variables = {
      mask_limit: "5",
      mozmail: "mozmail.com",
    };

    const newCallOut = (
      <span className={styles["new-callout"]}>
        {l10n.getString("highlighted-features-section-new-item")}
      </span>
    );

    return (
      <div className={styles["highlighted-feature-wrapper"]}>
        <div className={styles["highlighted-feature-description"]}>
          <>
            {/* Add "New" pill to new features */}
            {props.isNew && (
              <div className={styles["new-callout-wrapper"]}>{newCallOut}</div>
            )}
            <h3 className={styles["highlighted-feature-headline"]}>
              {l10n.getString(
                `highlighted-features-section-${props.name}-headline`
              )}
            </h3>
            <p className={styles["highlighted-feature-body"]}>
              {l10n.getString(
                `highlighted-features-section-${props.name}-body`,
                variables
              )}
            </p>
          </>
        </div>
        <Image
          alt=""
          src={props.image}
          className={styles["highlighted-feature-image"]}
        />
      </div>
    );
  };

  return (
    <div>
      <div className={styles["section-title-wrapper"]}>
        <h2>{l10n.getString("highlighted-features-section-title")}</h2>
      </div>
      <div className={styles["highlighted-items-container"]}>
        <HighlightedItem
          image={CreateUnlimitedEmailMasksImage}
          name={"unlimited-masks"}
        />

        <HighlightedItem
          image={CreateMasksOnTheGoImage}
          name={"masks-on-the-go"}
        />

        <HighlightedItem
          image={ReplyToEmailsAnonymouslyImage}
          name={"replying"}
        />

        <HighlightedItem
          image={BlockPromotionalEmailsImage}
          name={"block-promotions"}
        />

        <HighlightedItem
          image={RemoveEmailTrackersImage}
          name={"remove-trackers"}
        />
      </div>
      <div className={styles["section-title-wrapper"]}>
        <h2>{l10n.getString("highlighted-features-section-bottom-title")}</h2>
        <LinkButton className={styles["cta"]} href="#pricing">
          {l10n.getString("highlighted-features-section-bottom-cta")}
        </LinkButton>
      </div>
    </div>
  );
};
