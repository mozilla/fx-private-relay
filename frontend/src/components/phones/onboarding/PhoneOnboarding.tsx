import { ProfileData } from "../../../hooks/api/profile";
import styles from "./PhoneOnboarding.module.scss";
import {
  useRealPhonesData,
  isVerified,
  isNotVerified,
} from "../../../hooks/api/realPhone";
import { PurchasePhonesPlan } from "./PurchasePhonesPlan";
import { RealPhoneSetup } from "./RealPhoneSetup";
import { RelayNumberPicker } from "./RelayNumberPicker";
import { RuntimeDataWithPhonesAvailable } from "../../../functions/getPlan";

export type Props = {
  onComplete: () => void;
  profile: ProfileData;
  runtimeData: RuntimeDataWithPhonesAvailable;
};

export const PhoneOnboarding = (props: Props) => {
  const realPhoneData = useRealPhonesData();

  let step = null;

  // Show Upgrade Prompt - User has not yet purchased phone
  if (!props.profile.has_phone) {
    step = <PurchasePhonesPlan runtimeData={props.runtimeData} />;
  }

  // Make sure realPhoneData data is available
  if (realPhoneData.data === undefined) {
    return null;
  }

  const verifiedPhones = realPhoneData.data.filter(isVerified);
  const unverifiedPhones = realPhoneData.data.filter(isNotVerified);

  // Show Phone Verification
  if (realPhoneData.error || verifiedPhones.length === 0) {
    step = (
      <RealPhoneSetup
        unverifiedRealPhones={unverifiedPhones}
        onRequestVerification={async (number) =>
          await realPhoneData.requestPhoneVerification(number)
        }
        onRequestPhoneRemoval={async (id: number) =>
          await realPhoneData.requestPhoneRemoval(id)
        }
        onSubmitVerification={realPhoneData.submitPhoneVerification}
        runtimeData={props.runtimeData}
      />
    );
  }

  if (verifiedPhones.length > 0) {
    step = <RelayNumberPicker onComplete={props.onComplete} />;
  }

  return <main className={styles.onboarding}>{step}</main>;
};
