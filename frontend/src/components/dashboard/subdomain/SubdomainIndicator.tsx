import {
  useButton,
  useOverlay,
  useModal,
  useDialog,
  FocusScope,
  OverlayContainer,
  useOverlayPosition,
  AriaOverlayProps,
  mergeProps,
} from "react-aria";
import {
  forwardRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useRef,
} from "react";
import { useOverlayTriggerState } from "react-stately";
import styles from "./SubdomainIndicator.module.scss";
import { CloseIcon } from "../../Icons";
import { getRuntimeConfig } from "../../../config";
import { AddressPickerModal } from "../aliases/AddressPickerModal";
import { useMinViewportWidth } from "../../../hooks/mediaQuery";
import { useL10n } from "../../../hooks/l10n";

export type Props = {
  subdomain: string | null;
  onCreateAlias: (
    address: string,
    settings: { blockPromotionals: boolean }
  ) => void;
};

/**
 * Shows the user which subdomain they've chosen, and can show them more info on how to use it.
 */
export const SubdomainIndicator = (props: Props) => {
  if (props.subdomain === null) {
    return null;
  }

  return (
    <ExplainerTrigger
      subdomain={props.subdomain}
      onCreateAlias={props.onCreateAlias}
    />
  );
};

type ExplainerTriggerProps = {
  subdomain: string;
  onCreateAlias: (
    address: string,
    settings: { blockPromotionals: boolean }
  ) => void;
};
const ExplainerTrigger = (props: ExplainerTriggerProps) => {
  const l10n = useL10n();
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

  const onPick = (
    address: string,
    settings: { blockPromotionals: boolean }
  ) => {
    props.onCreateAlias(address, settings);
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
      {
        <OverlayContainer>
          <Explainer
            isOpen={explainerState.isOpen}
            onClose={explainerState.close}
            isDismissable
            positionProps={positionProps}
            ref={overlayRef}
          >
            <p className={styles.explanation}>
              {l10n.getString("popover-custom-alias-explainer-explanation-2")}
            </p>
            <p className={styles["button-heading"]}>
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-heading-2"
              )}
            </p>
            <button
              {...generateButtonProps}
              ref={generateButtonRef}
              className={styles["generate-button"]}
            >
              {l10n.getString(
                "popover-custom-alias-explainer-generate-button-label-2"
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
      }
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

type ExplainerProps = AriaOverlayProps & {
  children: ReactNode;
  positionProps: HTMLAttributes<HTMLElement>;
};
const Explainer = forwardRef<HTMLDivElement, ExplainerProps>(
  function ExplainerWithForwardedRef(props, overlayRef) {
    const l10n = useL10n();
    const isWideScreen = useMinViewportWidth("md");

    const { overlayProps } = useOverlay(
      props,
      overlayRef as RefObject<HTMLDivElement>
    );

    const { modalProps } = useModal();

    const { dialogProps, titleProps } = useDialog(
      {},
      overlayRef as RefObject<HTMLDivElement>
    );

    // On small screens, this is a dialog at the top of the viewport.
    // On wider screens, it is a popover attached to the indicator:
    const positionProps = isWideScreen ? props.positionProps : {};
    const mergedOverlayProps = mergeProps(
      overlayProps,
      positionProps,
      dialogProps,
      modalProps
    );

    return (
      <FocusScope contain restoreFocus autoFocus>
        <div
          {...mergedOverlayProps}
          ref={overlayRef}
          className={styles["explainer-wrapper"]}
          style={{
            ...mergedOverlayProps.style,
            display: !props.isOpen ? "none" : mergedOverlayProps.style?.display,
          }}
        >
          <h3 {...titleProps}>
            {l10n.getString("popover-custom-alias-explainer-heading-2")}
          </h3>
          {props.children}
        </div>
      </FocusScope>
    );
  }
);
