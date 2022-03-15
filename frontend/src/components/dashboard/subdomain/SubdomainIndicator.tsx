import { useLocalization } from "@fluent/react";
import {
  useButton,
  useOverlay,
  useModal,
  useDialog,
  FocusScope,
  OverlayContainer,
  useOverlayPosition,
} from "react-aria";
import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
} from "react";
import { useOverlayTriggerState } from "react-stately";
import { OverlayProps } from "@react-aria/overlays";
import styles from "./SubdomainIndicator.module.scss";
import { CloseIcon } from "../../Icons";
import { getRuntimeConfig } from "../../../config";
import { AddressPickerModal } from "../aliases/AddressPickerModal";

export type Props = {
  subdomain: string | null;
  onCreateAlias: (address: string) => void;
};

/**
 * Shows the user which subdomain they've chosen, and can show them more info on how to use it.
 */
export const SubdomainIndicator = (props: Props) => {
  if (props.subdomain === null) {
    return null;
  }

  if (getRuntimeConfig().featureFlags.generateCustomAliasSubdomain === true) {
    return (
      <ExplainerTrigger
        subdomain={props.subdomain}
        onCreateAlias={props.onCreateAlias}
      />
    );
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
  const { l10n } = useLocalization();
  const explainerState = useOverlayTriggerState({});
  const addressPickerState = useOverlayTriggerState({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const generateButtonRef = useRef<HTMLButtonElement>(null);

  const openButtonProps = useButton(
    { onPress: () => explainerState.open() },
    openButtonRef
  ).buttonProps;
  const closeButtonProps = useButton(
    { onPress: () => explainerState.close() },
    closeButtonRef
  ).buttonProps;
  const generateButtonProps = useButton(
    {
      onPress: () => {
        explainerState.close();
        addressPickerState.open();
      },
    },
    generateButtonRef
  ).buttonProps;

  const positionProps = useOverlayPosition({
    targetRef: openButtonRef,
    overlayRef: overlayRef,
    placement: "bottom left",
    offset: 16,
    isOpen: explainerState.isOpen,
  }).overlayProps;

  const onPick = (address: string) => {
    props.onCreateAlias(address);
    addressPickerState.close();
  };

  return (
    <>
      <button
        className={styles["open-button"]}
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
            <p className={styles["button-heading"]}>
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-heading"
              )}
            </p>
            <button
              {...generateButtonProps}
              ref={generateButtonRef}
              className={styles["generate-button"]}
            >
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-label"
              )}
            </button>
            <button
              {...closeButtonProps}
              ref={closeButtonRef}
              className={styles["close-button"]}
            >
              <CloseIcon
                alt={l10n.getString(
                  "popover-custom-alias-explainer-close-button-label"
                )}
              />
            </button>
          </Explainer>
        </OverlayContainer>
      )}
      {addressPickerState.isOpen && (
        <AddressPickerModal
          isOpen={addressPickerState.isOpen}
          onClose={() => addressPickerState.close()}
          onPick={onPick}
          subdomain={props.subdomain}
        />
      )}
    </>
  );
};

type ExplainerProps = OverlayProps & {
  children: ReactNode;
  positionProps: HTMLAttributes<HTMLElement>;
};
const Explainer = forwardRef<HTMLDivElement, ExplainerProps>(
  function ExplainerWithForwardedRef(props, overlayRef) {
    const { l10n } = useLocalization();

    const { overlayProps } = useOverlay(
      props,
      overlayRef as RefObject<HTMLDivElement>
    );

    const { modalProps } = useModal();

    const { dialogProps, titleProps } = useDialog(
      {},
      overlayRef as RefObject<HTMLDivElement>
    );

    return (
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...overlayProps}
          {...props.positionProps}
          {...dialogProps}
          {...modalProps}
          ref={overlayRef}
          className={styles["explainer-wrapper"]}
        >
          <h3 {...titleProps}>
            {l10n.getString("popover-custom-alias-explainer-heading")}
          </h3>
          {props.children}
        </div>
      </FocusScope>
    );
  }
);
