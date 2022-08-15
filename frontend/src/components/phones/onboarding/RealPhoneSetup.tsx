import { Localized, useLocalization } from "@fluent/react";
import styles from "./RealPhoneSetup.module.scss";
import PhoneVerify from "./images/phone-verify.svg";
import EnterVerifyCode from "./images/enter-verify-code.svg";
import EnterVerifyCodeError from "./images/verify-code-error.svg";
import { Button } from "../../Button";
import {
  hasPendingVerification,
  UnverifiedPhone,
  PhoneNumberSubmitVerificationFn,
} from "../../../hooks/api/realPhone";
import {
  ChangeEventHandler,
  FormEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { parseDate } from "../../../functions/parseDate";

type RealPhoneSetupProps = {
  unverifiedRealPhones: Array<UnverifiedPhone>;
  onRequestVerification: (numberToVerify: string) => void;
  onSubmitVerification: PhoneNumberSubmitVerificationFn;
};
export const RealPhoneSetup = (props: RealPhoneSetupProps) => {
  const phonesPendingVerification = props.unverifiedRealPhones.filter(
    hasPendingVerification
  );
  const [isEnteringNumber, setIsEnteringNumber] = useState(
    phonesPendingVerification.length === 0
  );

  if (isEnteringNumber || phonesPendingVerification.length === 0) {
    return (
      <RealPhoneForm
        requestPhoneVerification={(number) => {
          props.onRequestVerification(number);
          setIsEnteringNumber(false);
        }}
      />
    );
  }

  return (
    <RealPhoneVerification
      phonesPendingVerification={phonesPendingVerification}
      submitPhoneVerification={props.onSubmitVerification}
      onGoBack={() => setIsEnteringNumber(true)}
    />
  );
};

type RealPhoneFormProps = {
  requestPhoneVerification: (phoneNumber: string) => void;
};
const RealPhoneForm = (props: RealPhoneFormProps) => {
  const { l10n } = useLocalization();

  const [phoneNumber, setPhoneNumber] = useState("");

  const errorMessage = (
    <div className={`${styles["error"]}`}>
      {l10n.getString("phone-onboarding-step2-invalid-number", {
        phone_number: "+1 (000) 000-0000",
      })}
    </div>
  );

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setPhoneNumber(event.target.value);
  };

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();
    props.requestPhoneVerification(phoneNumber);
  };

  return (
    <div className={`${styles.step}  ${styles["step-verify-input"]} `}>
      <div className={styles.lead}>
        <img src={PhoneVerify.src} alt="" width={200} />
        <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step2-body")}</p>
      </div>
      {/* Add error class of `mzp-is-error` */}
      <form onSubmit={onSubmit} className={styles.form}>
        {/* TODO: Wrap error message in logic */}
        {errorMessage}

        <input
          className={`${styles["c-verify-phone-input"]}`}
          placeholder={l10n.getString(
            "phone-onboarding-step2-input-placeholder"
          )}
          type="tel"
          required={true}
          onChange={onChange}
          autoFocus={true}
        />
        {/* TODO: Add error class to input field */}
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step2-button-cta")}
        </Button>
      </form>
    </div>
  );
};

// TODO: Add logic to display the correct information between: default/error/success for the following Step Three
// Init state: Enter verification
// If 5 mins expire, show errorTimeExpired message
// If code is wrong, add is-error classes and update image/title
// If code is correct, show successWhatsNext and  update image/title
type RealPhoneVerificationProps = {
  phonesPendingVerification: UnverifiedPhone[];
  submitPhoneVerification: PhoneNumberSubmitVerificationFn;
  onGoBack: () => void;
};
const RealPhoneVerification = (props: RealPhoneVerificationProps) => {
  const { l10n } = useLocalization();

  const phoneWithMostRecentlySentVerificationCode =
    getPhoneWithMostRecentlySentVerificationCode(
      props.phonesPendingVerification
    );
  const [verificationCode, setVerificationCode] = useState("");
  const verificationSentDate = parseDate(
    phoneWithMostRecentlySentVerificationCode.verification_sent_date
  );
  const [remainingTime, setRemainingTime] = useState(
    getRemainingTime(verificationSentDate)
  );
  /** `undefined` if verification hasn't been attempted yet */
  const [isVerifiedSuccessfully, setIsVerifiedSuccessfully] =
    useState<boolean>();

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setVerificationCode(event.target.value);
  };

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const response = await props.submitPhoneVerification(
      phoneWithMostRecentlySentVerificationCode.id,
      {
        number: phoneWithMostRecentlySentVerificationCode.number,
        verification_code: verificationCode,
      }
    );

    setIsVerifiedSuccessfully(response.ok);
  };

  useInterval(() => {
    setRemainingTime(getRemainingTime(verificationSentDate));
  }, 1000);

  const errorTimeExpired = (
    <div
      className={`${styles["step-input-verificiation-code-timeout"]} ${
        remainingTime > 0 ? styles["is-hidden"] : ""
      }`}
    >
      <p>{l10n.getString("phone-onboarding-step3-error-exipred")}</p>
      <Button className={styles.button} type="submit">
        {l10n.getString("phone-onboarding-step3-error-cta")}
      </Button>
    </div>
  );

  const codeEntryPlaceholder = "000000";
  const remainingSeconds = Math.floor(remainingTime / 1000);
  const minuteCountdown = Math.floor(remainingSeconds / 60);
  const secondCountdown = remainingSeconds - minuteCountdown * 60;

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div
        className={`${styles.lead} ${
          isVerifiedSuccessfully === true ? styles["is-success"] : ""
        }  ${isVerifiedSuccessfully === false ? styles["is-error"] : ""}`}
      >
        <div
          className={`${styles["step-input-verificiation-code-lead-default"]}`}
        >
          {/* Default state */}
          <img src={EnterVerifyCode.src} alt="" width={300} />
          <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        </div>
        <div
          className={`${styles["step-input-verificiation-code-lead-error"]} `}
        >
          {/* Timeout error state */}
          <img src={EnterVerifyCodeError.src} alt="" width={170} />
          <h2 className={`${styles["is-error"]} `}>
            {l10n.getString("phone-onboarding-step3-code-fail-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step3-code-fail-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display timeout error */}
      {errorTimeExpired}

      <form
        onSubmit={onSubmit}
        className={`${styles.form} ${
          remainingTime < 0 ? styles["is-hidden"] : ""
        }`}
      >
        {/* TODO: Make remaining_time count backwards with "X minutes, XX seconds" */}
        <Localized
          id="phone-onboarding-step3-body"
          vars={{
            phone_number: formatPhone(
              phoneWithMostRecentlySentVerificationCode.number
            ),
            remaining_seconds: secondCountdown,
            remaining_minutes: minuteCountdown,
          }}
          elems={{
            span: <span className={`${styles["phone-number"]}`} />,
            strong: <strong />,
          }}
        >
          <p />
        </Localized>

        <input
          placeholder={codeEntryPlaceholder}
          required={true}
          onChange={onChange}
          className={isVerifiedSuccessfully === false ? styles["is-error"] : ""}
          autoFocus={true}
        />
        {/* TODO: Add logic to show success/fail on submit */}
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step3-button-cta")}
        </Button>

        {/* TODO: Enable logic to "go back" to previous step */}
        <Button
          onClick={() => props.onGoBack()}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step3-button-edit")}
        </Button>
      </form>

      {/* TODO: Resubmit phone number for verification and reset count down */}
      <Button className={styles.button} type="button" variant="secondary">
        {l10n.getString("phone-onboarding-step3-button-resend")}
      </Button>
    </div>
  );
};

type IntervalFunction = () => unknown | void;
// See https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback: IntervalFunction, delay: number) {
  const savedCallback = useRef<IntervalFunction | null>(null);

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      if (savedCallback.current !== null) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

function getRemainingTime(verificationSentTime: Date): number {
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - verificationSentTime.getTime();
  const remainingTime = 5 * 60 * 1000 - elapsedTime;
  return remainingTime;
}

function formatPhone(phoneNumber: string) {
  // Bug: Any country code with two characters will break
  // Return in +1 (111) 111-1111 format
  return `${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
    2,
    5
  )}) ${phoneNumber.substring(5, 8)}-${phoneNumber.substring(8, 12)}`;
}

function getPhoneWithMostRecentlySentVerificationCode(
  phones: UnverifiedPhone[]
) {
  const mostRecentVerifiedPhone = [...phones].sort((a, b) => {
    const sendDateA = parseDate(a.verification_sent_date).getTime();
    const sendDateB = parseDate(b.verification_sent_date).getTime();
    return sendDateA - sendDateB;
  });

  return mostRecentVerifiedPhone[0];
}
