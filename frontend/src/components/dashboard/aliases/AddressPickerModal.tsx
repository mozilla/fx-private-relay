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
import { ReactLocalization, useLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  useButton,
  AriaOverlayProps,
} from "react-aria";
import styles from "./AddressPickerModal.module.scss";
import { InfoIcon } from "../../Icons";
import { getRuntimeConfig } from "../../../config";
import { Button } from "../../Button";
import { InfoTooltip } from "../../InfoTooltip";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (address: string, settings: { blockPromotionals: boolean }) => void;
  subdomain: string;
};

/**
 * Modal in which the user can create a new custom alias,
 * while also being educated on why they don't need to do that.
 */
export const AddressPickerModal = (props: Props) => {
  const { l10n } = useLocalization();
  const [address, setAddress] = useState("");
  const [promotionalsBlocking, setPromotionalsBlocking] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef
  );
  /**
   * We need a Ref to the address picker field so that we can call the browser's
   * native validation APIs.
   * See:
   * - https://beta.reactjs.org/learn/manipulating-the-dom-with-refs
   * - https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/setCustomValidity
   */
  const addressFieldRef = useRef<HTMLInputElement>(null);

  const onChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    setAddress(event.target.value);
  };
  const onFocus: FocusEventHandler<HTMLInputElement> = () => {
    addressFieldRef.current?.setCustomValidity("");
  };
  const onBlur: FocusEventHandler<HTMLInputElement> = () => {
    addressFieldRef.current?.setCustomValidity(
      getAddressValidationMessage(address, l10n) ?? ""
    );
    addressFieldRef.current?.reportValidity();
  };

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    const validationMessage = getAddressValidationMessage(address, l10n);
    if (validationMessage) {
      addressFieldRef.current?.setCustomValidity(validationMessage);
      addressFieldRef.current?.reportValidity();
      return;
    }
    props.onPick(address.toLowerCase(), {
      blockPromotionals: promotionalsBlocking,
    });
  };

  return (
    <>
      <OverlayContainer>
        <PickerDialog
          title={l10n.getString("modal-custom-alias-picker-heading-2")}
          onClose={() => props.onClose()}
          isOpen={props.isOpen}
          isDismissable={true}
        >
          <div className={styles.warning}>
            <span className={styles["warning-icon"]}>
              <InfoIcon alt="" />
            </span>
            <p>{l10n.getString("modal-custom-alias-picker-warning-2")}</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className={styles["form-wrapper"]}>
              <p className={styles["form-heading"]}>
                {l10n.getString("modal-custom-alias-picker-form-heading-2")}
              </p>
              <div className={styles.prefix}>
                <label htmlFor="address">
                  {l10n.getString(
                    "modal-custom-alias-picker-form-prefix-label-2"
                  )}
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={onChange}
                  onFocus={onFocus}
                  onBlur={onBlur}
                  ref={addressFieldRef}
                  placeholder={l10n.getString(
                    "modal-custom-alias-picker-form-prefix-placeholder"
                  )}
                />
              </div>
              <span className={styles.suffix}>
                @<b>{props.subdomain}</b>.{getRuntimeConfig().mozmailDomain}
              </span>
            </div>
            <div className={styles["promotionals-blocking-control"]}>
              <input
                type="checkbox"
                id="promotionalsBlocking"
                onChange={(event) =>
                  setPromotionalsBlocking(event.target.checked)
                }
              />
              <label htmlFor="promotionalsBlocking">
                {l10n.getString(
                  "popover-custom-alias-explainer-promotional-block-checkbox"
                )}
              </label>
              <InfoTooltip
                alt={l10n.getString(
                  "popover-custom-alias-explainer-promotional-block-tooltip-trigger"
                )}
              >
                <h3>
                  {l10n.getString(
                    "popover-custom-alias-explainer-promotional-block-checkbox"
                  )}
                </h3>
                <p className={styles["promotionals-blocking-description"]}>
                  {l10n.getString(
                    "popover-custom-alias-explainer-promotional-block-tooltip-2"
                  )}
                  <Link href="/faq#faq-promotional-email-blocking">
                    <a>
                      {l10n.getString(
                        "banner-label-data-notification-body-cta"
                      )}
                    </a>
                  </Link>
                </p>
              </InfoTooltip>
            </div>
            <div className={styles.buttons}>
              <button
                {...cancelButton.buttonProps}
                ref={cancelButtonRef}
                className={styles["cancel-button"]}
              >
                {l10n.getString("profile-label-cancel")}
              </button>
              <Button type="submit" disabled={address.length === 0}>
                {l10n.getString(
                  "modal-custom-alias-picker-form-submit-label-2"
                )}
              </Button>
            </div>
          </form>
        </PickerDialog>
      </OverlayContainer>
    </>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  children: ReactNode;
  isOpen: boolean;
  onClose?: () => void;
};
const PickerDialog = (props: PickerDialogProps & AriaOverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
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
          <div className={styles.hero}>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};

export function getAddressValidationMessage(
  address: string,
  l10n: ReactLocalization
): null | string {
  if (address.length === 0) {
    return null;
  }
  if (address.includes(" ")) {
    return l10n.getString(
      "modal-custom-alias-picker-form-prefix-spaces-warning"
    );
  }
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
  if (!/^[a-z0-9]([a-z0-9-.]{0,61}[a-z0-9])?$/.test(address)) {
    return l10n.getString(
      "modal-custom-alias-picker-form-prefix-invalid-warning-2"
    );
  }
  return null;
}
