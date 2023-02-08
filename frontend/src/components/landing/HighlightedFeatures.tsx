import { useL10n } from "../../hooks/l10n";
import CreateUnlimitedEmailMasksImage from "./images/highlighted-features/features-unlimited-email-masks.svg";
import CreateMasksOnTheGoImage from "./images/highlighted-features/features-instantly-masks-on-the-go.svg";
import ReplyToEmailsAnonymouslyImage from "./images/highlighted-features/features-reply-to-emails-anon.svg";
import BlockPromotionalEmailsImage from "./images/highlighted-features/features-block-promotional-emails.svg";
import RemoveEmailTrackersImage from "./images/highlighted-features/features-remove-email-trackers.svg";

import Image, { StaticImageData } from "next/image";
import styles from "./HighlightedFeatures.module.scss";

type HighlightedItemProps = {
  image: StaticImageData;
  name: string;
  isNew?: void;
  hasVariable?: {
    var: string;
  };
};

export const HighlightedFeatures = () => {
  const l10n = useL10n();

  const HighlightedItem = (props: HighlightedItemProps) => {
    const variables = {
      mask_limit: "5",
      mozmail: "mozmail.com",
    };

    return (
      <div className={styles["highlighted-feature-wrapper"]}>
        <div className={styles["highlighted-feature-description"]}>
          <>
            {props.isNew && <div>New!</div>}
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
  );
};
