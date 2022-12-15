import styles from "./PhoneWelcomeView.module.scss";
import { Localized, useLocalization } from "@fluent/react";
import SavingRelayContactImg from "./images/save-relay-as-a-contact.svg";
import SavingRelayContactDemoImg from "./images/save-relay-contact-demo.svg";
import ReplyingMessagesImg from "./images/reply-to-messages.svg";
import ReplyingMessagesDemoImg from "./images/reply-to-messages-demo.svg";
import BlockingMessagesImg from "./images/block-a-sender.svg";
import { ReactNode } from "react";
import { Button } from "../../Button";
import { DismissalData } from "../../../hooks/localDismissal";
import { toast } from "react-toastify";
import { ProfileData } from "../../../hooks/api/profile";

type PhoneInstructionProps = {
  image: ReactNode;
  heading: string;
  body: ReactNode;
  demoHeading?: string;
  demoInput?: ReactNode;
  demoImage: ReactNode;
  alt: string;
};

const PhoneInstruction = (props: PhoneInstructionProps) => {
  return (
    <div className={styles["instruction-item"]}>
      {props.image}
      <h2>{props.heading}</h2>
      <p>{props.body}</p>
      <figure aria-hidden={props.alt === ""} className={styles["demo-wrapper"]}>
        <figcaption className={styles["demo-heading"]}>
          {props.demoHeading}
        </figcaption>
        <div
          aria-label={props.alt}
          className={styles["demo-input-wrapper"]}
          role="img"
        >
          {props.demoImage}
          <p className={styles["demo-input"]}>{props.demoInput}</p>
        </div>
      </figure>
    </div>
  );
};

type PhoneWelcomePageProps = {
  dismissal: {
    welcomeScreen: DismissalData;
    resendSMS: DismissalData;
  };
  onRequestContactCard: () => Promise<Response>;
  profile: ProfileData;
};

export const PhoneWelcomeView = (props: PhoneWelcomePageProps) => {
  const { l10n } = useLocalization();

  // The unlocalized strings here are demo data
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

  const DashboardBtn = (
    <Button
      className={styles["dashboard-btn"]}
      onClick={() => {
        props.dismissal.welcomeScreen.dismiss();
      }}
    >
      {l10n.getString("phone-masking-splash-continue-btn")}
    </Button>
  );

  return (
    <div className={styles["main-wrapper"]}>
      <div className={styles["main-heading"]}>
        <h1>{l10n.getString("phone-masking-splash-header")}</h1>
        <p>{l10n.getString("phone-masking-splash-subheading")}</p>
      </div>

      <div className={styles["phone-instructions-wrapper"]}>
        <PhoneInstruction
          alt=""
          image={<img src={SavingRelayContactImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-save-contact-title")}
          body={
            <>
              {l10n.getString("phone-masking-splash-save-contact-body")}
              <br />
              {!props.dismissal.resendSMS.isDismissed ? (
                <Button
                  onClick={async () => {
                    await props.onRequestContactCard();
                    toast(
                      l10n.getString(
                        "phone-banner-resend-welcome-sms-toast-msg"
                      ),
                      {
                        type: "success",
                      }
                    );
                    props.dismissal.resendSMS.dismiss();
                  }}
                  className={styles["welcome-text-cta"]}
                >
                  {l10n.getString("phone-masking-splash-save-contact-cta")}
                </Button>
              ) : null}
            </>
          }
          demoHeading={l10n.getString(
            "phone-masking-splash-save-contact-example"
          )}
          demoInput={
            <>
              {l10n.getString("phone-masking-splash-save-contact-example-text")}
              <div className={styles["relay-contact-icon"]}>FR</div>
            </>
          }
          demoImage={
            <div className={styles["demo-img"]}>
              <img src={SavingRelayContactDemoImg.src} alt="" />
            </div>
          }
        />

        <PhoneInstruction
          alt=""
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
          alt=""
          image={<img src={BlockingMessagesImg.src} alt="" />}
          heading={l10n.getString("phone-masking-splash-blocking-title")}
          body={
            <Localized
              id="phone-masking-splash-blocking-body"
              elems={{
                strong: <strong />,
              }}
            >
              <span></span>
            </Localized>
          }
          demoImage={BlockSenderDemo}
        />
      </div>
      {DashboardBtn}
    </div>
  );
};
