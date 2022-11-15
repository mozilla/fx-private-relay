import styles from "./PhoneWelcomeView.module.scss";
import { useLocalization } from "@fluent/react";
import SavingRelayContactImg from "./images/save-relay-as-a-contact.svg";
import SavingRelayContactDemoImg from "./images/save-relay-contact-demo.svg";
import ReplyingMessagesImg from "./images/reply-to-messages.svg";
import ReplyingMessagesDemoImg from "./images/reply-to-messages-demo.svg";
import BlockingMessagesImg from "./images/block-a-sender.svg";
import { ReactNode } from "react";

type PhoneInstructionProps = {
  image: ReactNode;
  heading: string;
  body: string;
  demoHeading?: string;
  demoInput?: string;
  demoImage: ReactNode;
};

const PhoneInstruction = (props: PhoneInstructionProps) => {
  return (
    <div className={styles["instruction-item"]}>
      {props.image}
      <h2>{props.heading}</h2>
      <p>{props.body}</p>
      <p className={styles["demo-heading"]}>{props.demoHeading}</p>
      <div className={styles["demo-wrapper"]}>
        <div className={styles["demo-input-wrapper"]}>
          <div className={styles["demo-img"]}>{props.demoImage}</div>
          <p className={styles["demo-input"]}>{props.demoInput}</p>
        </div>
      </div>
    </div>
  );
};

export const PhoneWelcomeView = () => {
  const { l10n } = useLocalization();

  const BlockSenderDemo = (
    <div>
      <ul>
        <li>
          <span>
            <p>Number</p>
            <p>
              {l10n.getString("phone-masking-splash-blocking-example-date")} -
              3:00pm
            </p>
          </span>
          <span>
            {l10n.getString("phone-masking-splash-blocking-example-unblock")}
          </span>
        </li>
        <li>
          <span>
            <p>John Doe</p>
            <p>08/23/2022 - 4:15pm</p>
          </span>
          <span>
            {l10n.getString("phone-masking-splash-blocking-example-block")}
          </span>
        </li>
      </ul>
    </div>
  );

  return (
    <div className={styles["main-wrapper"]}>
      <div className={styles["main-heading"]}>
        <h1>{l10n.getString("phone-masking-splash-header")}</h1>
        <p>{l10n.getString("phone-masking-splash-subheading")}</p>
      </div>

      <div className={styles["phone-instructions-wrapper"]}>
        <PhoneInstruction
          image={<img src={SavingRelayContactImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-save-contact-title")}
          body={l10n.getString("phone-masking-splash-save-contact-body")}
          // TODO: Localize strings
          demoHeading="Saving your Relay Contact"
          demoInput="Firefox Relay"
          demoImage={<img src={SavingRelayContactDemoImg.src} alt="" />}
        />

        <PhoneInstruction
          image={<img src={ReplyingMessagesImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-replies-title")}
          body={l10n.getString("phone-masking-splash-replies-body")}
          demoHeading={l10n.getString("phone-masking-splash-replies-example")}
          demoInput={l10n.getString(
            "phone-masking-splash-replies-example-text"
          )}
          demoImage={<img src={ReplyingMessagesDemoImg.src} alt="" />}
        />

        <PhoneInstruction
          image={<img src={BlockingMessagesImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-blocking-title")}
          body={l10n.getString("phone-masking-splash-blocking-body")}
          demoImage={BlockSenderDemo}
        />
      </div>
    </div>
  );
};
