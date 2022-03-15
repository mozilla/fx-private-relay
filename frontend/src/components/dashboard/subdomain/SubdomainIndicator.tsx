import { useLocalization } from "@fluent/react";
import { useButton, useOverlay, useModal, useDialog, FocusScope, OverlayContainer, useOverlayPosition } from "react-aria";
import { forwardRef, HTMLAttributes, ReactNode, RefObject, useRef } from "react";
import { useOverlayTriggerState } from "react-stately";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./SubdomainIndicator.module.scss";
import { CloseIcon } from "../../icons/close";
import { getRuntimeConfig } from "../../../config";
import { AddressPickerModal } from "../aliases/AddressPickerModal";

export type Props = {
  subdomain: string | null;
  onCreateAlias: (address: string) => void;
};

export const SubdomainIndicator = (props: Props) => {
  if (props.subdomain === null) {
    return null;
  }

  if (getRuntimeConfig().featureFlags.generateCustomAlias === true) {
    return <ExplainerTrigger subdomain={props.subdomain} onCreateAlias={props.onCreateAlias} />;
  }

  return (
    <>
      @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
    </>
  );
};

type ExplainerTriggerProps = {
  subdomain: string;
  onCreateAlias: (address: string) => void;
};
const ExplainerTrigger = (props: ExplainerTriggerProps) => {
  const {l10n} = useLocalization();
  const explainerState = useOverlayTriggerState({});
  const addressPickerState = useOverlayTriggerState({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);

  const openButtonProps = useButton({ onPress: () => explainerState.open() }, openButtonRef).buttonProps;
  const closeButtonProps = useButton({ onPress: () => explainerState.close() }, closeButtonRef).buttonProps;
  const generateButtonProps = useButton({ onPress: () => {
    explainerState.close();
    addressPickerState.open();
  }}, generateButtonRef).buttonProps;

  const positionProps = useOverlayPosition({
    targetRef: openButtonRef,
    overlayRef: overlayRef,
    placement: "bottom left",
    offset: 16,
    isOpen: explainerState.isOpen,
  }).overlayProps;

  return (
    <>
      <button
        className={styles.openButton}
        {...openButtonProps}
        ref={openButtonRef}
      >
        @{props.subdomain}.{getRuntimeConfig().mozmailDomain}
      </button>
      {explainerState.isOpen && (
        <OverlayContainer>
          <Explainer
            isOpen={explainerState.isOpen}
            onClose={explainerState.close}
            isDismissable
            positionProps={positionProps}
            ref={overlayRef}
          >
            <p className={styles.explanation}>
              {l10n.getString("popover-custom-alias-explainer-explanation")}
            </p>
            <p className={styles.buttonHeading}>
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-heading"
              )}
            </p>
            <button {...generateButtonProps} ref={generateButtonRef} className={styles.generateButton}>
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-label"
              )}
            </button>
            <button
              {...closeButtonProps}
              ref={closeButtonRef}
              aria-label={l10n.getString(
                "popover-custom-alias-explainer-close-button-label"
              )}
              className={styles.closeButton}
            >
              <CloseIcon />
            </button>
          </Explainer>
        </OverlayContainer>
      )}
      {addressPickerState.isOpen && (
        <AddressPickerModal
          isOpen={addressPickerState.isOpen}
          onClose={() => addressPickerState.close()}
          onPick={props.onCreateAlias}
          subdomain={props.subdomain}
        />
      )}
    </>
  );
};

type ExplainerProps = OverlayProps & { children: ReactNode; positionProps: HTMLAttributes<HTMLElement> };
const Explainer = forwardRef<HTMLDivElement, ExplainerProps>((props, overlayRef) => {
  const {l10n} = useLocalization();

  const {overlayProps} = useOverlay(props, overlayRef as RefObject<HTMLDivElement>);

  const {modalProps} = useModal();

  const {dialogProps, titleProps} = useDialog({}, overlayRef as RefObject<HTMLDivElement>);

  return (
    <FocusScope contain restoreFocus autoFocus>
      <div
        {...overlayProps}
        {...props.positionProps}
        {...dialogProps}
        {...modalProps}
        ref={overlayRef}
        className={styles.explainerWrapper}
      >
        <h3 {...titleProps}>
          {l10n.getString("popover-custom-alias-explainer-heading")}
        </h3>
        {props.children}
      </div>
    </FocusScope>
  );
});
