import styles from "./PhoneWelcomeView.module.scss";
import { Localized, useLocalization } from "@fluent/react";
import SavingRelayContactImg from "./images/save-relay-as-a-contact.svg";
import SavingRelayContactDemoImg from "./images/save-relay-contact-demo.svg";
import ReplyingMessagesImg from "./images/reply-to-messages.svg";
import ReplyingMessagesDemoImg from "./images/reply-to-messages-demo.svg";
import BlockingMessagesImg from "./images/block-a-sender.svg";
import { ReactNode } from "react";

type PhoneInstructionProps = {
  image: ReactNode;
  heading: string;
  body: ReactNode;
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
      <div className={styles["demo-wrapper"]}>
        <p className={styles["demo-heading"]}>{props.demoHeading}</p>
        <div className={styles["demo-input-wrapper"]}>
          {props.demoImage}
          <p className={styles["demo-input"]}>{props.demoInput}</p>
        </div>
      </div>
    </div>
  );
};

export const PhoneWelcomeView = () => {
  const { l10n } = useLocalization();

  const BlockSenderDemo = (
    <div className={styles["block-sender-wrapper"]}>
      <ul>
        <li>
          <span>
            <p>+1 (726) 777-7777</p>
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
          demoImage={
            <div className={styles["demo-img"]}>
              <img src={SavingRelayContactDemoImg.src} alt="" />
            </div>
          }
        />

        <PhoneInstruction
          image={<img src={ReplyingMessagesImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-replies-title")}
          body={l10n.getString("phone-masking-splash-replies-body")}
          demoHeading={l10n.getString("phone-masking-splash-replies-example")}
          demoInput={l10n.getString(
            "phone-masking-splash-replies-example-text"
          )}
          demoImage={
            <div className={styles["demo-img"]}>
              <img src={ReplyingMessagesDemoImg.src} alt="" />
            </div>
          }
        />

        <PhoneInstruction
          image={<img src={BlockingMessagesImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-blocking-title")}
          body={
            <Localized
              id="phone-masking-splash-blocking-body"
              elems={{
                strong: <strong />,
              }}
            ></Localized>
          }
          demoImage={BlockSenderDemo}
        />
      </div>
    </div>
  );
};
