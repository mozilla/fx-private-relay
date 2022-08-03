import { useProfiles } from "../../../hooks/api/profile";
import styles from "./PhoneOnboarding.module.scss";
import {
  useRealPhonesData,
  isVerified,
  isNotVerified,
} from "../../../hooks/api/realPhone";
import { PurchasePhonesPlan } from "./PurchasePhonesPlan";
import { RealPhoneSetup } from "./RealPhoneSetup";
import { RelayNumberPicker } from "./RelayNumberPicker";

export type Props = {
  onComplete: () => void;
};

export const PhoneOnboarding = (props: Props) => {
  const profiles = useProfiles();
  const realPhoneData = useRealPhonesData();

  let step = null;

  // Make sure profile data is available
  if (profiles.data?.[0] === undefined) {
    return <>TODO: Profile Loading/Error</>;
  }

  // Show Upgrade Prompt - User has not yet purchased phone
  if (!profiles.data?.[0].has_phone) {
    step = <PurchasePhonesPlan />;
  }

  // Make sure realPhoneData data is available
  if (realPhoneData.data === undefined) {
    return <>TODO: realPhoneData Loading/Error</>;
  }

  const verifiedPhones = realPhoneData.data.filter(isVerified);
  const unverifiedPhones = realPhoneData.data.filter(isNotVerified);

  // Show Phone Verification
  if (realPhoneData.error || verifiedPhones.length === 0) {
    step = (
      <RealPhoneSetup
        unverifiedRealPhones={unverifiedPhones}
        onRequestVerification={(number) =>
          realPhoneData.requestPhoneVerification(number)
        }
        onSubmitVerification={realPhoneData.submitPhoneVerification}
      />
    );
  }

  if (verifiedPhones.length > 0) {
    step = <RelayNumberPicker onComplete={props.onComplete} />;
  }

  return (
    <>
      <main className={styles.onboarding}>{step}</main>
    </>
  );
};
