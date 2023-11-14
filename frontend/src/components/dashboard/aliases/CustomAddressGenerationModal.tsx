import {
  ButtonHTMLAttributes,
  ChangeEventHandler,
  FormEvent,
  FormEventHandler,
  ReactElement,
  ReactNode,
  RefObject,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import Congratulations from "../images/free-onboarding-congratulations.svg";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  useButton,
  AriaOverlayProps,
  ButtonAria,
} from "react-aria";
import styles from "./CustomAddressGenerationModal.module.scss";
import {
  BulletPointIcon,
  CheckIcon,
  CloseIconNormal,
  CopyIcon,
  ErrorTriangleIcon,
  InfoBulbIcon,
  InvalidIcon,
} from "../../Icons";
import { Button } from "../../Button";
import { InfoTooltip } from "../../InfoTooltip";
import { useL10n } from "../../../hooks/l10n";
import { ProfileData, useProfiles } from "../../../hooks/api/profile";
import { getRuntimeConfig } from "../../../config";
import { MenuTriggerState, useMenuTriggerState } from "react-stately";
import { AliasData } from "../../../hooks/api/aliases";
import Image from "next/image";
import { ReactLocalization } from "@fluent/react";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (
    aliasToUpdate: AliasData | undefined,
    blockPromotions: boolean,
    copyToClipboard: boolean | undefined,
  ) => void;
  onPick: (address: string, setErrorState: (flag: boolean) => void) => void;
  subdomain: string;
  aliasGeneratedState: boolean;
  findAliasDataFromPrefix: (aliasPrefix: string) => AliasData | undefined;
};

/**
 * Modal in which the user can create a new custom alias,
 * while also being educated on why they don't need to do that.
 */
export const CustomAddressGenerationModal = (props: Props) => {
  const profileData = useProfiles();
  const l10n = useL10n();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef,
  );
  const [address, setAddress] = useState("");
  const errorExplainerState = useMenuTriggerState({});
  const profile = profileData.data?.[0];
  if (!profile) {
    return null;
  }

  return (
    <>
      <OverlayContainer>
        <PickerDialog
          title={
            !props.aliasGeneratedState
              ? l10n.getString("modal-custom-alias-picker-heading-2")
              : l10n.getString("modal-domain-register-success-title")
          }
          onClose={() => props.onClose()}
          isOpen={props.isOpen}
          isDismissable={true}
          errorStateIsOpen={errorExplainerState.isOpen}
          errorStateOnClose={errorExplainerState.close}
          aliasGeneratedState={props.aliasGeneratedState}
        >
          {!props.aliasGeneratedState ? (
            <CustomMaskCreator
              l10n={l10n}
              address={address}
              profile={profile}
              errorExplainerState={errorExplainerState}
              cancelButton={cancelButton}
              cancelButtonRef={cancelButtonRef}
              onPick={props.onPick}
              setAddress={setAddress}
            />
          ) : (
            <CustomMaskSuccess
              l10n={l10n}
              address={address}
              profile={profile}
              findAliasDataFromPrefix={props.findAliasDataFromPrefix}
              onUpdate={props.onUpdate}
            />
          )}
        </PickerDialog>
      </OverlayContainer>
    </>
  );
};

type CustomMaskCreatorProps = {
  l10n: ReactLocalization;
  address: string;
  profile: ProfileData;
  errorExplainerState: MenuTriggerState;
  cancelButton: ButtonAria<ButtonHTMLAttributes<HTMLButtonElement>>;
  cancelButtonRef: RefObject<HTMLButtonElement>;
  onPick: (address: string, setErrorState: (flag: boolean) => void) => void;
  setAddress: (address: string) => void;
};

const CustomMaskCreator = (props: CustomMaskCreatorProps) => {
  const {
    l10n,
    profile,
    errorExplainerState,
    cancelButton,
    cancelButtonRef,
    onPick,
    address,
    setAddress,
  } = props;
  /**
   * We need a Ref to the address picker field so that we can call the browser's
   * native validation APIs.
   * See:
   * - https://beta.reactjs.org/learn/manipulating-the-dom-with-refs
   * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setCustomValidity
   */
  const addressFieldRef = useRef<HTMLInputElement>(null);
  const containsUppercase = /[A-Z]/.test(address);
  const containsSymbols = !/^[A-Za-z0-9.-]*$/.test(address);

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    const isValid = isAddressValid(address);
    isValid
      ? onPick(address.toLowerCase(), errorExplainerState.setOpen)
      : errorExplainerState.setOpen(!isValid);
  };
  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setAddress(event.target.value);
    if (errorExplainerState.isOpen) {
      errorExplainerState.close();
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className={styles["form-wrapper"]}>
        <div className={styles.prefix}>
          <label htmlFor="address">
            {l10n.getString("modal-custom-alias-picker-form-prefix-label-3")}
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={onChange}
            ref={addressFieldRef}
            placeholder={l10n.getString(
              "modal-custom-alias-picker-form-prefix-placeholder-redesign",
            )}
            autoCapitalize="none"
            className={`${
              errorExplainerState.isOpen || containsUppercase || containsSymbols
                ? styles["invalid-prefix"]
                : null
            }`}
          />
          <ErrorTooltip
            containsUppercase={containsUppercase}
            containsSymbols={containsSymbols}
            address={address}
          />
          <label
            htmlFor="address"
            className={styles["profile-registered-domain-value"]}
          >
            @{profile.subdomain}.{getRuntimeConfig().mozmailDomain}
          </label>
        </div>
      </div>

      <hr />
      <div className={styles.buttons}>
        <button
          {...cancelButton.buttonProps}
          ref={cancelButtonRef}
          className={styles["end-button"]}
        >
          {l10n.getString("profile-label-cancel")}
        </button>
        <Button
          type="submit"
          disabled={
            address.length === 0 || containsUppercase || containsSymbols
          }
        >
          {l10n.getString("modal-custom-alias-picker-form-submit-label-2")}
        </Button>
      </div>
    </form>
  );
};

type CustomMaskSuccessProps = {
  l10n: ReactLocalization;
  address: string;
  profile: ProfileData;
  findAliasDataFromPrefix: (aliasPrefix: string) => AliasData | undefined;
  onUpdate: (
    aliasToUpdate: AliasData | undefined,
    blockPromotions: boolean,
    copyToClipboard: boolean | undefined,
  ) => void;
};

const CustomMaskSuccess = (props: CustomMaskSuccessProps) => {
  const { l10n, address, profile, findAliasDataFromPrefix, onUpdate } = props;

  const [promotionalsBlocking, setPromotionalsBlocking] = useState(false);

  const onFinished = (event: FormEvent, copyToClipboard?: boolean) => {
    event.preventDefault();
    const newlyCreatedAliasData = findAliasDataFromPrefix(address);
    onUpdate(newlyCreatedAliasData, promotionalsBlocking, copyToClipboard);
  };

  const updatePromotionsCheckbox: ChangeEventHandler<HTMLInputElement> = (
    event,
  ) => {
    setPromotionalsBlocking(event.target.checked);
  };

  return (
    <form
      onSubmit={(e) => {
        onFinished(e, true);
      }}
    >
      <div className={styles["newly-created-mask"]}>
        <Image
          src={Congratulations}
          alt={l10n.getString("modal-domain-register-success-title")}
        />
        <p>
          {address}@{profile.subdomain}.{getRuntimeConfig().mozmailDomain}
        </p>
      </div>
      <div className={styles["promotionals-blocking-control"]}>
        <input
          type="checkbox"
          id="promotionalsBlocking"
          onChange={updatePromotionsCheckbox}
        />
        <label htmlFor="promotionalsBlocking">
          {l10n.getString(
            "popover-custom-alias-explainer-promotional-block-checkbox-label",
          )}
        </label>
        <InfoTooltip
          alt={l10n.getString(
            "popover-custom-alias-explainer-promotional-block-tooltip-trigger",
          )}
          iconColor="black"
        >
          <h3>
            {l10n.getString(
              "popover-custom-alias-explainer-promotional-block-checkbox",
            )}
          </h3>
          <p className={styles["promotionals-blocking-description"]}>
            {l10n.getString(
              "popover-custom-alias-explainer-promotional-block-tooltip-2",
            )}
            <Link href="/faq#faq-promotional-email-blocking">
              {l10n.getString("banner-label-data-notification-body-cta")}
            </Link>
          </p>
        </InfoTooltip>
      </div>
      <div className={styles.tip}>
        <span className={styles["tip-icon"]}>
          <InfoBulbIcon alt="" />
        </span>
        <p>{l10n.getString("modal-custom-alias-picker-tip-redesign")}</p>
      </div>
      <hr />
      <div className={styles.buttons}>
        <button className={styles["end-button"]} onClick={onFinished}>
          {l10n.getString("done-msg")}
        </button>
        <Button type="submit">
          {l10n.getString("copy-mask")}
          <CopyIcon alt="" />
        </Button>
      </div>
    </form>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  errorStateIsOpen: boolean;
  errorStateOnClose: () => void;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
  aliasGeneratedState: boolean;
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
          <InvalidPrefixBanner
            isOpen={props.errorStateIsOpen}
            onClose={props.errorStateOnClose}
          />
          <div className={styles.hero}>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};

type ErrorTooltipProps = {
  containsUppercase: boolean;
  containsSymbols: boolean;
  address: string;
};

const ErrorTooltip = (props: ErrorTooltipProps) => {
  const l10n = useL10n();
  const { containsUppercase, containsSymbols, address } = props;

  return (
    <span className={styles.wrapper}>
      <span className={styles.tooltip}>
        <div className={styles.errors}>
          <ErrorStateIcons address={address} errorState={containsUppercase} />
          <p>
            {l10n.getString(
              "error-alias-picker-prefix-invalid-uppercase-letters",
            )}
          </p>
        </div>
        <div className={styles.errors}>
          <ErrorStateIcons address={address} errorState={containsSymbols} />
          <p>{l10n.getString("error-alias-picker-prefix-invalid-symbols")}</p>
        </div>
      </span>
    </span>
  );
};

type ErrorStateProps = {
  errorState: boolean;
  address: string;
};

const ErrorStateIcons = (props: ErrorStateProps) => {
  const { errorState, address } = props;
  const l10n = useL10n();

  return (
    <>
      <div className={styles["error-icons"]}>
        {address === "" ? (
          <BulletPointIcon alt="" className={styles["bullet-icon"]} />
        ) : !errorState ? (
          <CheckIcon
            alt={l10n.getString("error-state-valid-alt")}
            className={styles["check-icon"]}
          />
        ) : (
          <InvalidIcon
            alt={l10n.getString("error-state-invalid-alt")}
            className={styles["close-icon"]}
          />
        )}
      </div>
    </>
  );
};

type InvalidPrefixProps = {
  isOpen: boolean;
  onClose: () => void;
};

const InvalidPrefixBanner = (props: InvalidPrefixProps) => {
  const l10n = useL10n();

  return (
    <div
      className={`${styles["invalid-address-wrapper"]} ${
        props.isOpen ? styles["active"] : null
      }`}
    >
      <div className={styles["invalid-address-msg"]}>
        <div className={styles["left-content"]}>
          <ErrorTriangleIcon alt="" className={styles["prefix-error-icon"]} />
          <p>{l10n.getString("error-alias-picker-prefix-invalid")}</p>
        </div>
        <button
          onClick={props.onClose}
          className={`${styles["prefix-error-icon"]}  ${styles["close-button"]}`}
        >
          <CloseIconNormal alt={l10n.getString("close-button-label-alt")} />
        </button>
      </div>
    </div>
  );
};

export function isAddressValid(address: string): boolean {
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
