import {
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import { useLocalization } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  useButton,
} from "react-aria";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./AddressPickerModal.module.scss";
import { InfoIcon } from "../../Icons";
import { getRuntimeConfig } from "../../../config";
import { Button } from "../../Button";
import { suggestAddress } from "../../../functions/suggestAddress";

export type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (address: string) => void;
  subdomain: string;
};

/**
 * Modal in which the user can create a new custom alias,
 * while also being educated on why they don't need to do that.
 */
export const AddressPickerModal = (props: Props) => {
  const { l10n } = useLocalization();
  const [address, setAddress] = useState(suggestAddress(l10n));
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButton = useButton(
    { onPress: () => props.onClose() },
    cancelButtonRef
  );

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    props.onPick(address);
  };

  return (
    <>
      <OverlayContainer>
        <PickerDialog
          title={l10n.getString("modal-custom-alias-picker-heading")}
          onClose={() => props.onClose()}
          isOpen={props.isOpen}
          isDismissable={true}
        >
          <div className={styles.warning}>
            <span className={styles.warningIcon}>
              <InfoIcon alt="" />
            </span>
            <p>{l10n.getString("modal-custom-alias-picker-warning")}</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className={styles.formWrapper}>
              <p className={styles.formHeading}>
                {l10n.getString("modal-custom-alias-picker-form-heading")}
              </p>
              <div className={styles.prefix}>
                <label htmlFor="address">
                  {l10n.getString(
                    "modal-custom-alias-picker-form-prefix-label"
                  )}
                </label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={l10n.getString(
                    "modal-custom-alias-picker-form-prefix-placeholder"
                  )}
                />
              </div>
              <span className={styles.suffix}>
                @<b>{props.subdomain}</b>.{getRuntimeConfig().mozmailDomain}
              </span>
            </div>
            <div className={styles.buttons}>
              <button
                {...cancelButton.buttonProps}
                ref={cancelButtonRef}
                className={styles.cancelButton}
              >
                {l10n.getString("profile-label-cancel")}
              </button>
              <Button type="submit" disabled={address.length === 0}>
                {l10n.getString("modal-custom-alias-picker-form-submit-label")}
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
const PickerDialog = (props: PickerDialogProps & OverlayProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { overlayProps, underlayProps } = useOverlay(props, wrapperRef);
  usePreventScroll();
  const { modalProps } = useModal();
  const { dialogProps, titleProps } = useDialog({}, wrapperRef);

  return (
    <div className={styles.underlay} {...underlayProps}>
      <FocusScope contain restoreFocus autoFocus>
        <div
          className={styles.dialogWrapper}
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
