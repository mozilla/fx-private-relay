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
import { RuntimeData } from "../../../hooks/api/runtimeData";
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
  onRequestVerification: (numberToVerify: string) => Promise<Response>;
  onSubmitVerification: PhoneNumberSubmitVerificationFn;
  runtimeData: RuntimeData;
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
          setIsEnteringNumber(false);
          return props.onRequestVerification(number);
        }}
      />
    );
  }

  return (
    <RealPhoneVerification
      phonesPendingVerification={phonesPendingVerification}
      submitPhoneVerification={props.onSubmitVerification}
      requestPhoneVerification={(number) => {
        setIsEnteringNumber(false);
        return props.onRequestVerification(number);
      }}
      maxMinutesToVerify={props.runtimeData.MAX_MINUTES_TO_VERIFY_REAL_PHONE}
      onGoBack={() => setIsEnteringNumber(true)}
    />
  );
};

type RealPhoneFormProps = {
  requestPhoneVerification: (phoneNumber: string) => Promise<Response>;
};

const RealPhoneForm = (props: RealPhoneFormProps) => {
  const { l10n } = useLocalization();

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberSubmitted, setPhoneNumberSubmitted] = useState("");
  const errorMessage = useRef<HTMLDivElement>(null);
  const phoneNumberField = useRef<HTMLInputElement>(null);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setPhoneNumber(event.target.value);
  };

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    // use this number to show user the number they submitted
    setPhoneNumberSubmitted(phoneNumber);

    // submit the request for phone verification
    const res = await props.requestPhoneVerification(phoneNumber);

    // check if the phone number was successfully submitted for verification
    if (res.status !== 201) {
      // show error message if the phone number was not submitted for verification successfully
      errorMessage.current?.classList.remove(styles["is-hidden"]);
      // add error class to input field
      phoneNumberField.current?.classList.add(styles["is-error"]);
    }
  };

  const renderErrorMessage = (
    <div
      ref={errorMessage}
      className={`${styles["error"]} ${styles["is-hidden"]}`}
    >
      {l10n.getString("phone-onboarding-step2-invalid-number", {
        phone_number: formatPhone(phoneNumberSubmitted),
      })}
    </div>
  );

  return (
    <div className={`${styles.step}  ${styles["step-verify-input"]} `}>
      <div className={styles.lead}>
        <img src={PhoneVerify.src} alt="" width={200} />
        <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step2-body")}</p>
      </div>
      {/* Add error class of `mzp-is-error` */}
      <form onSubmit={onSubmit} className={styles.form}>
        {renderErrorMessage}

        <input
          className={`${styles["c-verify-phone-input"]}`}
          placeholder={l10n.getString(
            "phone-onboarding-step2-input-placeholder"
          )}
          ref={phoneNumberField}
          type="tel"
          required={true}
          onChange={onChange}
          autoFocus={true}
        />
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
  requestPhoneVerification: (numberToVerify: string) => Promise<Response>;
  maxMinutesToVerify: number;
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
    getRemainingTime(verificationSentDate, props.maxMinutesToVerify)
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
    setRemainingTime(
      getRemainingTime(verificationSentDate, props.maxMinutesToVerify)
    );
  }, 1000);

  const errorTimeExpired = (
    <div
      className={`${styles["step-input-verificiation-code-timeout"]} ${
        remainingTime > 0 ? styles["is-hidden"] : ""
      }`}
    >
      <p>{l10n.getString("phone-onboarding-step3-error-exipred")}</p>
      <Button
        className={styles.button}
        type="button"
        onClick={() => {
          props.requestPhoneVerification(
            phoneWithMostRecentlySentVerificationCode.number
          );
        }}
      >
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
          {/* button here */}
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
          maxLength={6}
          onChange={onChange}
          className={isVerifiedSuccessfully === false ? styles["is-error"] : ""}
          autoFocus={true}
        />
        {/* TODO: add validation */}
        <Button
          className={styles.button}
          type="submit"
          disabled={verificationCode.length === 0 || verificationCode === " "}
        >
          {l10n.getString("phone-onboarding-step3-button-cta")}
        </Button>
      </form>

      {(remainingTime < 0 || !isVerifiedSuccessfully) && (
        <Button
          onClick={() => props.onGoBack()}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step3-button-edit")}
        </Button>
      )}
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

function getRemainingTime(
  verificationSentTime: Date,
  maxMinutesToVerify: number
): number {
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - verificationSentTime.getTime();
  const remainingTime = maxMinutesToVerify * 60 * 1000 - elapsedTime;
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
