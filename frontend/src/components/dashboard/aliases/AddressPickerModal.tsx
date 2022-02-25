import {
  FormEventHandler,
  ReactElement,
  ReactNode,
  useRef,
  useState,
} from "react";
import Link from "next/link";
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

  const onSubmit: FormEventHandler = (event) => {
    event.preventDefault();

    props.onPick(address, { blockPromotionals: promotionalsBlocking });
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
