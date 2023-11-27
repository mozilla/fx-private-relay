import {
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  AriaOverlayProps,
} from "react-aria";
import styles from "./EmailForwardingModal.module.scss";
import { useL10n } from "../../hooks/l10n";
import Image from "next/image";
import ForwardEmail from "./images/free-onboarding-forwarding-email.svg";
import ForwardedEmail from "./images/free-onboarding-forwarding-congratulations.svg";
import { Button } from "../Button";
import { StaticImport } from "next/dist/shared/lib/get-img-props";
import { CloseIcon } from "../Icons";
import { aliasEmailTest } from "../../hooks/api/aliases";
import { event as gaEvent } from "react-ga";

export type Props = {
  isOpen: boolean;
  isSet: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onComplete: () => void;
};

/**
 * Modal in which the user can provide an email mask to test email forwarding
 */
export const EmailForwardingModal = (props: Props) => {
  if (!props.isOpen) return null;

  return !props.isSet ? (
    <OverlayContainer>
      <ConfirmModal {...props} />
    </OverlayContainer>
  ) : (
    <OverlayContainer>
      <SuccessModal {...props} />
    </OverlayContainer>
  );
};

const ConfirmModal = (props: Props) => {
  const l10n = useL10n();
  const [inputValue, setInputValue] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const isValid = formRef.current?.reportValidity();

    if (isValid) {
      inputRef.current?.blur();

      const response = await aliasEmailTest(inputValue);

      if (response) {
        props.onConfirm();

        gaEvent({
          category: "Free Onboarding",
          action: "Engage",
          label: "onboarding-step-2-forwarding-test",
          value: 1,
        });
      }
    }
  };

  return (
    <PickerDialog
      headline={l10n.getString(
        "profile-free-onboarding--copy-mask-try-out-email-forwarding",
      )}
      onClose={() => props.onClose()}
      image={ForwardEmail}
      isOpen={props.isOpen}
      isDismissable={true}
    >
      <div className={styles["paste-email-mask-container"]}>
        <p className={styles["modal-title"]}>
          {l10n.getString("profile-free-onboarding--copy-mask-paste-the-email")}
        </p>
        <form
          onSubmit={onSubmit}
          ref={formRef}
          className={styles["label-form"]}
        >
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            aria-label={l10n.getString("profile-label-edit-2")}
            ref={inputRef}
            className={styles["label-input"]}
            placeholder={l10n.getString(
              "profile-free-onboarding--copy-mask-placeholder-relay-email-mask",
            )}
            type="email"
          />
        </form>
      </div>
      <Button
        className={styles["generate-new-mask"]}
        type="submit"
        onClick={onSubmit}
      >
        {l10n.getString("profile-free-onboarding--copy-mask-send-email")}
      </Button>

      <button className={styles["nevermind-link"]} onClick={props.onClose}>
        {l10n.getString("profile-free-onboarding--copy-mask-nevermind")}
      </button>
    </PickerDialog>
  );
};

const SuccessModal = (props: Props) => {
  const l10n = useL10n();

  return (
    <PickerDialog
      headline={l10n.getString(
        "profile-free-onboarding--copy-mask-check-inbox",
      )}
      onClose={() => props.onClose()}
      image={ForwardedEmail}
      isOpen={props.isOpen}
      isDismissable={true}
    >
      <div className={styles["paste-email-mask-container"]}>
        <p className={styles["modal-title-success"]}>
          {l10n.getString("profile-free-onboarding--copy-mask-email-this-mask")}
        </p>
      </div>
      <Button
        className={styles["generate-new-mask"]}
        onClick={props.onComplete}
      >
        {l10n.getString("profile-free-onboarding--copy-mask-continue")}
      </Button>
    </PickerDialog>
  );
};

type PickerDialogProps = {
  title?: string | ReactElement;
  headline?: string;
  image: string | StaticImport;
  isOpen: boolean;
  onClose?: () => void;
  children?: ReactNode;
};

const PickerDialog = (props: PickerDialogProps & AriaOverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const l10n = useL10n();
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  usePreventScroll();
  const { modalProps } = useModal();
  const { dialogProps, titleProps } = useDialog({}, wrapperRef);

  return (
    <div className={styles.underlay} {...underlayProps}>
      <FocusScope contain restoreFocus autoFocus>
        <div
          className={styles["dialog-wrapper"]}
          {...overlayProps}
          {...dialogProps}
          {...modalProps}
          ref={wrapperRef}
        >
          <CloseIcon
            className={styles["close-icon"]}
            alt={l10n.getString("profile-free-onboarding--close-modal")}
            onClick={props.onClose}
          />
          <div className={styles.hero}>
            <p className={styles.headline}>{props.headline}</p>
            <Image src={props.image} alt="" />
            <p {...titleProps}>{props.title}</p>
            {props.children}
          </div>
        </div>
      </FocusScope>
    </div>
  );
};
