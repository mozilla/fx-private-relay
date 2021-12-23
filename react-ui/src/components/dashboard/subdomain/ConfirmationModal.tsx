import { ReactElement, ReactNode, useRef } from "react";
import { useLocalization, Localized } from "@fluent/react";
import {
  OverlayContainer,
  FocusScope,
  useDialog,
  useModal,
  useOverlay,
  usePreventScroll,
} from "react-aria";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./ConfirmationModal.module.scss";
import checkIcon from "../../../../../static/images/icon-green-check.svg";
import { SubdomainConfirmationForm } from "./ConfirmationForm";
import { getRuntimeConfig } from "../../../config";

export type Props = {
  subdomain: string;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export const SubdomainConfirmationModal = (props: Props) => {
  return (
    <>
      <OverlayContainer>
        <PickerDialog
          title={
            <Localized
              id="modal-domain-register-available-v2"
              vars={{
                subdomain: props.subdomain,
                domain: getRuntimeConfig().mozmailDomain,
              }}
              elems={{
                subdomain: <span className={styles.subdomain} />,
                domain: <span className={styles.domain} />,
              }}
            >
              <span className={styles.modalTitle} />
            </Localized>
          }
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
  const { l10n } = useLocalization();

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
            <span className={styles.headline}>
              <img src={checkIcon.src} alt="" />
              {l10n.getString("modal-domain-register-good-news")}
            </span>
            <h3 {...titleProps}>{props.title}</h3>
          </div>
          {props.children}
        </div>
      </FocusScope>
    </div>
  );
};
