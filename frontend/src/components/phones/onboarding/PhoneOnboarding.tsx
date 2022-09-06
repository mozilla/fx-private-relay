import { useProfiles } from "../../../hooks/api/profile";
import styles from "./PhoneOnboarding.module.scss";
import {
  useRealPhonesData,
  isVerified,
  isNotVerified,
} from "../../../hooks/api/realPhone";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { PurchasePhonesPlan } from "./PurchasePhonesPlan";
import { RealPhoneSetup } from "./RealPhoneSetup";
import { RelayNumberPicker } from "./RelayNumberPicker";

export type Props = {
  onComplete: () => void;
};

export const PhoneOnboarding = (props: Props) => {
  const profiles = useProfiles();
  const realPhoneData = useRealPhonesData();
  const runtimeData = useRuntimeData();

  let step = null;

  // Make sure profile and runtime data are available
  if (profiles.data?.[0] === undefined || !runtimeData.data) {
    return null;
  }

  // Show Upgrade Prompt - User has not yet purchased phone
  if (!profiles.data?.[0].has_phone) {
    step = <PurchasePhonesPlan />;
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
        runtimeData={runtimeData.data}
      />
    );
  }

  if (verifiedPhones.length > 0) {
    step = <RelayNumberPicker onComplete={props.onComplete} />;
  }

  return <main className={styles.onboarding}>{step}</main>;
};
