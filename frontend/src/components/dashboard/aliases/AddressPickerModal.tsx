import {
  ChangeEventHandler,
  FocusEventHandler,
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { ReactLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  useButton,
  AriaOverlayProps,
} from "react-aria";
import styles from "./AddressPickerModal.module.scss";
import { CheckIcon, CloseIcon, CloseIconNormal, ErrorTriangleIcon, InfoBulbIcon, InvalidIcon, WarningFilledIcon } from "../../Icons";
import { Button } from "../../Button";
import { InfoTooltip } from "../../InfoTooltip";
import { useL10n } from "../../../hooks/l10n";
import { useRuntimeData } from "../../../hooks/api/runtimeData";
import { useProfiles } from "../../../hooks/api/profile";
import { getRuntimeConfig } from "../../../config";
import { useMenuTriggerState, useTooltipTriggerState } from "react-stately";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (address: string) => void;
  subdomain: string;
  isAliasCreated: boolean;
};

/**
 * Modal in which the user can create a new custom alias,
 * while also being educated on why they don't need to do that.
 */
export const AddressPickerModal = (props: Props) => {
  const profileData = useProfiles();
  const l10n = useL10n();
  const [address, setAddress] = useState("");
  const [promotionalsBlocking, setPromotionalsBlocking] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef,
  );
  const errorExplainerState = useMenuTriggerState({});

  /**
   * We need a Ref to the address picker field so that we can call the browser's
   * native validation APIs.
   * See:
   * - https://beta.reactjs.org/learn/manipulating-the-dom-with-refs
   * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setCustomValidity
   */
  const addressFieldRef = useRef<HTMLInputElement>(null);
  const containsUppercase = (/[A-Z]/.test(address));
  // This regex checks to see that the address only consists of either A-Z, a-z, 0-9, ., or -, if it does not, then it contains special characters 
  // A more strict check is done upon submission in getAddressValidationMessage() which will show an error message for edge cases.
  //    ^ marks the start of the string
  //    $ marks the end of the string
  //    * matches any characters defined zero or more times
  const containsSymbols = !(/^[A-Za-z0-9.-]*$/.test(address));
  
  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setAddress(event.target.value);
    errorExplainerState.isOpen ? errorExplainerState.close() : null;
  };
  const profile = profileData.data?.[0];
  if (!profile) {
    return null;
  }
  
  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();
    
    const isValid = isAddressValid(address);
    isValid ? props.onPick(address.toLowerCase()) : errorExplainerState.setOpen(!isValid);
  };
  // on "done" or "copied", set isAliasCreated false.
  return (
    <>
      <OverlayContainer>
        <PickerDialog
          title={!props.isAliasCreated ? l10n.getString("modal-custom-alias-picker-heading-2") : l10n.getString("modal-domain-register-success-title")}
          onClose={() => props.onClose()}
          isOpen={props.isOpen}
          isDismissable={true}
          errorStateIsOpen={errorExplainerState.isOpen}
          errorStateOnClose={errorExplainerState.close}
          isAliasCreated={props.isAliasCreated}
        >
          <form onSubmit={onSubmit}>
            <div className={styles["form-wrapper"]}>
              <div className={styles.prefix}>
                <label htmlFor="address">
                  {l10n.getString(
                    "modal-custom-alias-picker-form-prefix-label-3",
                  )}
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={onChange}
                  ref={addressFieldRef}
                  placeholder={l10n.getString(
                    "modal-custom-alias-picker-form-prefix-placeholder-3",
                  )}
                  autoCapitalize="none"
                  className={`${errorExplainerState.isOpen || containsUppercase || containsSymbols ? styles["invalid-prefix"] : null}`}
                />
                <ErrorTooltip containsUppercase={containsUppercase} containsSymbols={containsSymbols} />
                <label htmlFor="address" className={styles["profile-registered-domain-value"]}>
                  @{profile.subdomain}.{getRuntimeConfig().mozmailDomain}
                </label>
              </div>
            </div>
            
            <hr />
            <div className={styles.buttons}>
              <button
                {...cancelButton.buttonProps}
                ref={cancelButtonRef}
                className={styles["cancel-button"]}
              >
                {l10n.getString("profile-label-cancel")}
              </button>
              <Button type="submit" disabled={address.length === 0 || containsUppercase || containsSymbols}>
                {l10n.getString(
                  "modal-custom-alias-picker-form-submit-label-2",
                )}
              </Button>
            </div>
          </form>
        </PickerDialog>
        
        
      </OverlayContainer>
    </>
  );
};

type ErrorTooltipProps = {
  containsUppercase: boolean;
  containsSymbols: boolean;
}

const ErrorTooltip = (props: ErrorTooltipProps) => {
  const l10n = useL10n();
  const { containsUppercase, containsSymbols } = props;
  
  return (
    <span className={styles.wrapper}>
      <span className={styles.tooltip} >
        <div className={styles.errors}>
          <ErrorStateIcons errorState={containsUppercase} />
          <p>
            {l10n.getString("error-alias-picker-prefix-invalid-uppercase-letters")}
          </p>
        </div>
        <div className={styles.errors}>
          <ErrorStateIcons errorState={containsSymbols} />
          <p>
            {l10n.getString("error-alias-picker-prefix-invalid-symbols")}
          </p>
        </div>
      </span>
    </span>
  );
};

type ErrorStateProps = {
  errorState: boolean;
}

const ErrorStateIcons = (props: ErrorStateProps) => {
  const { errorState } = props;

  return (
    <>
    {!errorState ? (
      <CheckIcon alt="" className={styles["check-icon"]} />
    ) : ( 
      <InvalidIcon alt="" className={styles["close-icon"]} />
    )
    }
    </>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  errorStateIsOpen: boolean;
  errorStateOnClose: () => void;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  isAliasCreated: boolean;
};
const PickerDialog = (props: PickerDialogProps & AriaOverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  const { modalProps } = useModal();
  const { dialogProps, titleProps } = useDialog({}, wrapperRef);

  return (
    <div className={styles.underlay} {...underlayProps}>
      <FocusScope contain restoreFocus>
        <div
          className={styles["dialog-wrapper"]}
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          ref={wrapperRef}
        >

          <InvalidPrefixBanner isOpen={props.errorStateIsOpen} onClose={props.errorStateOnClose} />

          <div className={styles.hero}>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {!props.isAliasCreated ? 
            props.children 
            :
            // Add success component
            <div>
              Success
            </div> 
          }
        </div>
      </FocusScope>
    </div>
  );
};

type InvalidPrefixProps = {
  isOpen: boolean;
  onClose: () => void;
}

const InvalidPrefixBanner = (props: InvalidPrefixProps) => {
  const l10n = useL10n()

  return (
    <div className={`${styles["invalid-address-wrapper"]} ${props.isOpen ? styles["active"] : null}`}>
      <div className={styles["invalid-address-msg"]}>
        <div className={styles["left-content"]}>
          <div className={styles["prefix-error-icon"]}>
            <ErrorTriangleIcon  alt="" />
          </div>
          <p>
            {l10n.getString("error-alias-picker-prefix-invalid")}
          </p>
        </div>
        <button onClick={props.onClose} className={`${styles["prefix-error-icon"]}  ${styles["close-button"]}`}>
          <CloseIconNormal alt="" />
        </button>
      </div>
    </div>
  );
}
export function isAddressValid(
  address: string,
): boolean {
  // Regular expression:
  //
  //   ^[a-z0-9]  Starts with a lowercase letter or number;
  //
  //   (...)?     followed by zero or one of:
  //
  //              [a-z0-9-.]{0,61} zero up to 61 lowercase letters, numbers, hyphens, or periods, and
  //              [a-z0-9]         a lowercase letter or number (but not a hyphen),
  //
  //   $          and nothing following that.
  //
  // All that combines to 1-63 lowercase characters, numbers, or hyphens,
  // but not starting or ending with a hyphen, aligned with the backend's
  // validation (`valid_address_pattern` in emails/models.py).
  return /^[a-z0-9]([a-z0-9-.]{0,61}[a-z0-9])?$/.test(address);
}
