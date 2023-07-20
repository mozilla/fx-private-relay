import { ReactElement, ReactNode, useRef } from "react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
  AriaOverlayProps,
} from "react-aria";
import styles from "./ConfirmationModal.module.scss";
import { CheckCircleIcon, CheckIcon } from "../../Icons";
import { SubdomainConfirmationForm } from "./ConfirmationForm";
import { Button } from "../../Button";
import { useL10n } from "../../../hooks/l10n";
import { Localized } from "../../Localized";

export type Props = {
  subdomain: string;
  isOpen: boolean;
  isSet: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onComplete: () => void;
};

/**
 * Modal in which the user can confirm that they really want to permanently claim a given subdomain.
 */
export const SubdomainConfirmationModal = (props: Props) => {
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

  return (
    <PickerDialog
      title={
        <Localized
          id="modal-email-domain-available"
          vars={{
            custom_domain_full: `${props.subdomain}.mozmail.com`,
          }}
          elems={{
            p: <p className={styles.subdomain} />,
          }}
        >
          <span className={styles["modal-title"]} />
        </Localized>
      }
      headline={l10n.getString("modal-email-domain-good-news")}
      onClose={() => props.onClose()}
      isOpen={props.isOpen}
      isDismissable={true}
    >
      <SubdomainConfirmationForm
        subdomain={props.subdomain}
        onCancel={() => props.onClose()}
        onConfirm={() => props.onConfirm()}
      />
    </PickerDialog>
  );
};

const SuccessModal = (props: Props) => {
  const l10n = useL10n();

  return (
    <div className={styles["picked-confirmation"]}>
      <PickerDialog
        title={
          <Localized
            id="modal-email-domain-success-subheadline"
            vars={{
              custom_domain_full: `${props.subdomain}.mozmail.com`,
            }}
            elems={{
              p: <p className={styles.subdomain} />,
            }}
          >
            <span className={styles["modal-title"]} />
          </Localized>
        }
        headline={l10n.getString("modal-domain-register-success-title")}
        onClose={() => props.onClose()}
        isOpen={props.isOpen}
        isDismissable={true}
      >
        <div className={styles["picked-confirmation-body"]}>
          <p className={styles["picked-confirmation-body-content"]}>
            <ul className={styles["feature-item-list"]}>
              <li>
                <CheckIcon alt={""} className={styles["check-icon"]} />
                <p>
                  <strong>
                    {l10n.getString(
                      "modal-email-domain-success-headline-on-the-go",
                    )}
                  </strong>
                  <p>
                    {l10n.getString(
                      "modal-email-domain-success-body-on-the-go",
                    )}
                  </p>
                </p>
              </li>
              <li>
                <CheckIcon alt={""} className={styles["check-icon"]} />
                <p>
                  <strong>
                    {l10n.getString(
                      "modal-email-domain-success-headline-any-word",
                    )}
                  </strong>
                  <p>
                    {l10n.getString(
                      "modal-email-domain-success-body-any-word",
                      {
                        custom_domain_full: `@${props.subdomain}.mozmail.com`,
                      },
                    )}
                  </p>
                </p>
              </li>
            </ul>
          </p>

          <Button onClick={() => props.onComplete()}>
            {l10n.getString("profile-label-continue")}
          </Button>
        </div>
      </PickerDialog>
    </div>
  );
};

type PickerDialogProps = {
  title: string | ReactElement;
  headline: string;
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
            <span className={styles.headline}>
              <CheckCircleIcon alt="" />
              {props.headline}
            </span>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};
