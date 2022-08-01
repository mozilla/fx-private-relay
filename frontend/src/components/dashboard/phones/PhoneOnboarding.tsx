import { useProfiles } from "../../../hooks/api/profile";
import { event as gaEvent } from "react-ga";
import styles from "./PhoneOnboarding.module.scss";
import { Localized, useLocalization } from "@fluent/react";
import FlagUS from "./images/flag-usa.svg";
import WomanPhone from "./images/woman-phone.svg";
import PhoneVerify from "./images/phone-verify.svg";
import EnteryVerifyCode from "./images/enter-verify-code.svg";
import EnteryVerifyCodeError from "./images/verify-code-error.svg";
import EnteryVerifyCodeSuccess from "./images/verify-code-success.svg";
import { Button, LinkButton } from "../../Button";
import { useGaViewPing } from "../../../hooks/gaViewPing";
import { getPhoneSubscribeLink } from "../../../functions/getPlan";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import {
  useRealPhonesData,
  isVerified,
  hasVerificationSentDates,
  VerifiedPhone,
  useRelayNumber,
  getRelayNumberSuggestions,
} from "../../../hooks/api/phone";
import {
  ChangeEventHandler,
  FormEventHandler,
  MouseEventHandler,
  useEffect,
  useRef,
  useState,
} from "react";
import { parseDate } from "../../../functions/parseDate";

export const PhoneOnboarding = () => {
  const profiles = useProfiles();
  const realPhoneData = useRealPhonesData();
  const relayNumberData = useRelayNumber();
  const [phoneOnboardingStep, setPhoneOnboardingStep] = useState(0);

  useEffect(() => {
    const data = window.localStorage.getItem("phoneOnboardingStep");
    if (data !== null) setPhoneOnboardingStep(JSON.parse(data));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "phoneOnboardingStep",
      JSON.stringify(phoneOnboardingStep)
    );
  }, [phoneOnboardingStep]);

  let step = null;

  // Make sure profile data is available
  if (profiles.data?.[0] === undefined) {
    return <>TODO: Profile Loading/Error</>;
  }

  // Show Upgrade Prompt - User has not yet purchased phone
  if (!profiles.data?.[0].has_phone) {
    step = <StepOne />;
    return (
      <>
        <section className={styles.onboarding}>{step}</section>
      </>
    );
  }

  // Make sure realPhoneData data is available
  if (realPhoneData.data === undefined) {
    return <>TODO: realPhoneData Loading/Error</>;
  }

  const verifiedPhones = realPhoneData.data.filter(isVerified);

  const updateStepCount = (state: number) => {
    setPhoneOnboardingStep(state);
  };

  // Show Phone Verification
  if (realPhoneData.error || verifiedPhones.length === 0) {
    step = (
      <StepTwo
        updateStepCount={updateStepCount}
        currentOnboardingStep={phoneOnboardingStep}
        requestPhoneVerification={realPhoneData.requestPhoneVerification}
      />
    );
  }

  const phonesWithRecentVerificationSentDates = realPhoneData.data.filter(
    hasVerificationSentDates
  );

  if (
    verifiedPhones.length === 0 &&
    phonesWithRecentVerificationSentDates.length > 0 &&
    phoneOnboardingStep > 2
  ) {
    // If verification_sent_date is set and is not 5 mins old
    step = (
      <StepThree
        updateStepCount={updateStepCount}
        getVerifiedPhones={phonesWithRecentVerificationSentDates}
        submitPhoneVerification={realPhoneData.submitPhoneVerification}
        requestPhoneVerification={realPhoneData.requestPhoneVerification}
      />
    );
  }

  // TODO: Check if relay number is registered
  if (verifiedPhones.length > 0 && phoneOnboardingStep > 2) {
    // Show Relay Registration Step OR Phone Dashboard
    step = <StepThreeSuccess updateStepCount={updateStepCount} />;
  }

  // TODO: Check if relay number is registered
  if (verifiedPhones.length > 0 && phoneOnboardingStep > 3) {
    step = (
      <StepFour
        registerRelayNumber={relayNumberData.registerRelayNumber}
        updateStepCount={updateStepCount}
      />
    );
  }

  // TODO: Check if relay number is registered
  if (relayNumberData.data && phoneOnboardingStep > 4) {
    // Show Relay Registration Step OR Phone Dashboard
    step = <StepFourSuccess />;
  }

  return (
    <>
      <section className={styles.onboarding}>{step}</section>
    </>
  );
};

const StepOne = () => {
  const { l10n } = useLocalization();
  const runtimeData = useRuntimeData();

  const purchase = () => {
    gaEvent({
      category: "Purchase Button",
      action: "Engage",
      label: "phone-cta",
    });
  };

  return (
    <div className={`${styles.step} ${styles["step-welcome"]}`}>
      <div className={styles.lead}>
        <img src={WomanPhone.src} alt="" width={200} />
        <h2>{l10n.getString("phone-onboarding-step1-headline")}</h2>
        <p>{l10n.getString("phone-onboarding-step1-body")}</p>
      </div>
      <div className={styles.description}>
        <ul>
          <li>{l10n.getString("phone-onboarding-step1-list-item-1")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-2")}</li>
          <li>{l10n.getString("phone-onboarding-step1-list-item-3")}</li>
        </ul>
        <div className={styles.action}>
          <h3>
            {l10n.getString("phone-onboarding-step1-button-label")}
            <span>{l10n.getString("phone-onboarding-step1-button-price")}</span>
          </h3>
          <LinkButton
            ref={useGaViewPing({
              category: "Purchase Button",
              label: "premium-promo-cta",
            })}
            href={getPhoneSubscribeLink(runtimeData.data)}
            onClick={() => purchase()}
          >
            {l10n.getString("premium-promo-hero-cta")}
          </LinkButton>
        </div>
      </div>
    </div>
  );
};

type StepTwoProps = {
  currentOnboardingStep: number;
  updateStepCount: (step: number) => void;
  requestPhoneVerification: (phoneNumber: string) => Promise<Response>;
};

const StepTwo = (props: StepTwoProps) => {
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

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();
    const response = await props.requestPhoneVerification(phoneNumber);

    if (response.ok) {
      props.updateStepCount(3);
    }
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

type StepThreeProps = {
  getVerifiedPhones: VerifiedPhone[];
  requestPhoneVerification: (phoneNumber: string) => void;
  submitPhoneVerification: (
    id: number,
    obj: { number: string; verification_code: string }
  ) => Promise<Response>;
  updateStepCount: (step: number) => void;
};

type IntervalFunction = () => unknown | void;

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

function parseRemainingTime(verificationSentTime: number): number {
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - verificationSentTime;
  const remainingTime = 5 * 60 * 1000 - elapsedTime;
  return remainingTime;
}

function formatTime(remainingMilliseconds: number) {
  const remainingSeconds = Math.floor(remainingMilliseconds / 1000);
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds - minutes * 60;

  // Add a leading 0 if it's under 10 seconds.
  const formmatedSeconds = seconds < 10 ? `0${seconds}` : seconds;

  return `${minutes}:${formmatedSeconds}`;
}

function formatPhone(phoneNumber: string) {
  // Bug: Any country code with two characters will break
  // Return in +1 (111) 111-1111 format
  return `${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
    2,
    5
  )}) ${phoneNumber.substring(5, 8)}-${phoneNumber.substring(8, 12)}`;
}

function getStartingSeconds(phones: VerifiedPhone[]) {
  const mostRecentVerifiedPhone = phones.sort((a, b) => {
    const sendDateA = parseDate(a.verification_sent_date).getTime();
    const sendDateB = parseDate(b.verification_sent_date).getTime();
    return sendDateA - sendDateB;
  });

  return parseDate(mostRecentVerifiedPhone[0].verification_sent_date).getTime();
}

function getVerificationPhoneData(phones: VerifiedPhone[]) {
  const mostRecentVerifiedPhone = phones.sort((a, b) => {
    const sendDateA = parseDate(a.verification_sent_date).getTime();
    const sendDateB = parseDate(b.verification_sent_date).getTime();
    return sendDateA - sendDateB;
  });

  return mostRecentVerifiedPhone[0];
}

const StepThree = (props: StepThreeProps) => {
  const { l10n } = useLocalization();

  const inputRef = useRef<HTMLInputElement>(null);
  const leadRef = useRef<HTMLDivElement>(null);
  const expiredErrorMsg = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const verifiedPhoneData = getVerificationPhoneData(props.getVerifiedPhones);
  const [phoneNumber] = useState(verifiedPhoneData.number);
  const [verificationCode, setVerificationCode] = useState("");
  const [remainingTime, setRemainingTime] = useState(
    parseRemainingTime(getStartingSeconds(props.getVerifiedPhones))
  );

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setVerificationCode(event.target.value);
  };

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const response = await props.submitPhoneVerification(verifiedPhoneData.id, {
      number: phoneNumber,
      verification_code: verificationCode,
    });

    if (response.ok) {
      leadRef.current?.classList.add(`${styles["is-success"]}`);
    } else {
      leadRef.current?.classList.add(`${styles["is-error"]}`);
      inputRef.current?.classList.add(`${styles["is-error"]}`);
    }
  };

  useInterval(() => {
    if (remainingTime < 0) {
      expiredErrorMsg.current?.classList.remove(`${styles["is-hidden"]}`);
      formRef.current?.classList.add(`${styles["is-hidden"]}`);
    }

    setRemainingTime(
      parseRemainingTime(getStartingSeconds(props.getVerifiedPhones))
    );
  }, 1000);

  const errorTimeExpired = (
    <div
      ref={expiredErrorMsg}
      className={`${styles["step-input-verificiation-code-timeout"]} ${styles["is-hidden"]} `}
    >
      <p>{l10n.getString("phone-onboarding-step3-error-exipred")}</p>
      <Button className={styles.button} type="submit">
        {l10n.getString("phone-onboarding-step3-error-cta")}
      </Button>
    </div>
  );

  const codeEntryPlaceholder = "000000";

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div ref={leadRef} className={styles.lead}>
        <div
          className={`${styles["step-input-verificiation-code-lead-default"]}`}
        >
          {/* Default state */}
          <img src={EnteryVerifyCode.src} alt="" width={300} />
          <h2>{l10n.getString("phone-onboarding-step2-headline")}</h2>
        </div>
        <div
          className={`${styles["step-input-verificiation-code-lead-error"]} `}
        >
          {/* Timeout error state */}
          <img src={EnteryVerifyCodeError.src} alt="" width={170} />
          <h2 className={`${styles["is-error"]} `}>
            {l10n.getString("phone-onboarding-step3-code-fail-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step3-code-fail-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display timeout error */}
      {errorTimeExpired}

      {/* <form onSubmit={onSubmit} className={`${styles.form}`}> */}
      <form ref={formRef} onSubmit={onSubmit} className={styles.form}>
        {/* TODO: Make remaining_time count backwards with "X minutes, XX seconds" */}
        <Localized
          id="phone-onboarding-step3-body"
          vars={{
            phone_number: formatPhone(phoneNumber),
            remaining_time: formatTime(remainingTime),
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
          ref={inputRef}
        />
        {/* TODO: Add logic to show success/fail on submit */}
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step3-button-cta")}
        </Button>

        {/* TODO: Enable logic to "go back" to previous step */}
        <Button
          onClick={() => props.updateStepCount(2)}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step3-button-edit")}
        </Button>
      </form>

      {/* TODO: Resubmit phone number for verification and reset count down */}
      {/* onClick={() => props.requestPhoneVerification(phoneNumber)} */}
      <Button className={styles.button} type="button" variant="secondary">
        {l10n.getString("phone-onboarding-step3-button-resend")}
      </Button>
    </div>
  );
};

type StepThreeSuccessProps = {
  updateStepCount: (step: number) => void;
};

const StepThreeSuccess = (props: StepThreeSuccessProps) => {
  const { l10n } = useLocalization();

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div className={`${styles.lead}  ${styles["is-success"]} `}>
        <div
          className={`${styles["step-input-verificiation-code-lead-success"]} `}
        >
          {/* Success state */}
          <img src={EnteryVerifyCodeSuccess.src} alt="" width={170} />
          <h2 className={`${styles["is-success"]} `}>
            {l10n.getString("phone-onboarding-step3-code-success-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step3-code-success-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display success message */}

      <div className={`${styles["step-input-verificiation-code-success"]} `}>
        <h3>
          {l10n.getString("phone-onboarding-step3-code-success-subhead-title")}
        </h3>
        <p>
          {l10n.getString("phone-onboarding-step3-code-success-subhead-body")}
        </p>
        <Button
          onClick={() => props.updateStepCount(4)}
          className={styles.button}
        >
          {l10n.getString("phone-onboarding-step3-code-success-cta")}
        </Button>
      </div>
    </div>
  );
};

type StepFourProps = {
  registerRelayNumber: (phoneNumber: string) => Promise<Response>;
  updateStepCount: (step: number) => void;
};

const StepFour = (props: StepFourProps) => {
  const { l10n } = useLocalization();

  // TODO: Defaulting to true to stop FoUC however we need to catch any error in await getRelayNumberSuggestions();
  const [isLoading, setIsLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [relayNumberSuggestions, setRelayNumberSuggestions] = useState<
    string[]
  >([]);
  const [sliceStart, setSliceStart] = useState(0);
  const [sliceEnd, setSliceEnd] = useState(3);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      const resp = await getRelayNumberSuggestions();
      setIsLoading(false);
      const respObject = await resp.json();
      const suggestedNumbers: string[] = [];

      // TODO: DRY If statements below
      if (respObject.other_areas_options) {
        for (const otherAreaOption of respObject.other_areas_options) {
          suggestedNumbers.push(otherAreaOption.phone_number);
        }
      }

      if (respObject.same_area_options) {
        for (const sameAreaOption of respObject.same_area_options) {
          suggestedNumbers.push(sameAreaOption.phone_number);
        }
      }

      if (respObject.same_prefix_options) {
        for (const samePrefixOption of respObject.same_prefix_options) {
          suggestedNumbers.push(samePrefixOption.phone_number);
        }
      }

      setRelayNumberSuggestions(suggestedNumbers);
    })();
  }, []);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setPhoneNumber(event.target.value);
  };

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();
    const response = await props.registerRelayNumber(phoneNumber);
    if (response.ok) {
      props.updateStepCount(5);
    }
  };

  const loadingState = isLoading ? (
    <div className={`${styles["step-select-phone-number-mask-loading"]} `}>
      <div className={styles.loading} />
      <p>{l10n.getString("phone-onboarding-step3-loading")}</p>
    </div>
  ) : null;

  const moreRelayNumberOptions: MouseEventHandler<HTMLButtonElement> = () => {
    setSliceStart(sliceStart + 3);
    setSliceEnd(sliceEnd + 3);
  };

  const suggestedNumberRadioInputs = relayNumberSuggestions
    .slice(sliceStart, sliceEnd)
    .map((suggestion, i) => {
      function formatPhone(phoneNumber: string) {
        // Bug: Any country code with two characters will break
        // Return in +1 (111) 111-1111 format
        return `${phoneNumber.substring(0, 2)} (${phoneNumber.substring(
          2,
          5
        )}) ${phoneNumber.substring(5, 8)}-${phoneNumber.substring(8, 12)}`;
      }

      return (
        <div key={suggestion}>
          <input
            onChange={onChange}
            type="radio"
            name="phoneNumberMask"
            id={`number${i}`}
            value={suggestion}
            // Note: If you need to hardcode for testing:
            // value="+15005550006"
          />
          <label htmlFor={`number${i}`}>{formatPhone(suggestion)}</label>
        </div>
      );
    });

  const form = isLoading ? null : (
    <div className={`${styles["step-select-phone-number-mask"]} `}>
      <div className={styles.lead}>
        <img src={FlagUS.src} alt="" width={45} />
        <span>{l10n.getString("phone-onboarding-step4-country-us")}</span>
      </div>

      <form onSubmit={onSubmit} className={styles.form}>
        <input
          className={styles.search}
          placeholder={l10n.getString("phone-onboarding-step4-insput-search")}
          type="search"
        />

        <p className={styles.paragraph}>
          {l10n.getString("phone-onboarding-step4-body")}
        </p>

        <div className={`${styles["step-select-relay-numbers-radio-group"]} `}>
          {suggestedNumberRadioInputs}
        </div>

        <Button
          onClick={moreRelayNumberOptions}
          className={styles.button}
          type="button"
          variant="secondary"
        >
          {l10n.getString("phone-onboarding-step4-button-more-options")}
        </Button>

        {/* TODO: Add error class to input field */}
        <Button className={styles.button} type="submit">
          {l10n.getString("phone-onboarding-step2-button-cta")}
        </Button>
      </form>
    </div>
  );

  return (
    <div className={`${styles.step}`}>
      {/* TODO: Add logic to show this instead of step-select-phone-number-mask when loading */}
      {loadingState}
      {form}
    </div>
  );
};

const StepFourSuccess = () => {
  const { l10n } = useLocalization();

  return (
    <div
      className={`${styles.step}  ${styles["step-input-verificiation-code"]} `}
    >
      <div className={`${styles.lead}  ${styles["is-success"]} `}>
        <div
          className={`${styles["step-input-verificiation-code-lead-success"]} `}
        >
          {/* Success state */}
          <img src={EnteryVerifyCodeSuccess.src} alt="" width={170} />
          <h2 className={`${styles["is-success"]} `}>
            {l10n.getString("phone-onboarding-step4-code-success-title")}
          </h2>
          <p>{l10n.getString("phone-onboarding-step4-code-success-body")}</p>
        </div>
      </div>
      {/* Add error class of `mzp-is-error` */}

      {/* TODO: Add logic to display success message */}

      <div className={`${styles["step-input-verificiation-code-success"]} `}>
        <h3>
          {l10n.getString("phone-onboarding-step4-code-success-subhead-title")}
        </h3>
        <p>
          {l10n.getString(
            "phone-onboarding-step4-code-success-subhead-body-p1"
          )}
        </p>
        <p>
          {l10n.getString(
            "phone-onboarding-step4-code-success-subhead-body-p2"
          )}
        </p>
        <Button className={styles.button}>
          {l10n.getString("phone-onboarding-step4-code-success-cta")}
        </Button>
      </div>
    </div>
  );
};
