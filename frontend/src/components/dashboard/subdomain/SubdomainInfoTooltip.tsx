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
import { CloseIcon, InfoIcon } from "../../Icons";
import { useMinViewportWidth } from "../../../hooks/mediaQuery";
import { useL10n } from "../../../hooks/l10n";
import styles from "./SubdomainInfoTooltip.module.scss";
import { Localized } from "../../Localized";
import { InfoModal } from "../../InfoModal";

export type SubdomainInfoTooltipProps = {
  hasPremium: boolean;
};

/**
 * Shows the user more info on how to use their Relay custom domain mask.
 */
export const SubdomainInfoTooltip = (props: SubdomainInfoTooltipProps) => {
  const isLargeScreen = useMinViewportWidth("md");
  const { hasPremium } = props;

  return (
    <>
      {isLargeScreen ? (
        <ExplainerTrigger hasPremium={hasPremium} />
      ) : (
        <MobileExplainerModal hasPremium={hasPremium} />
      )}
    </>
  );
};

export type MobileExplainerModalProps = {
  hasPremium: boolean;
};

const MobileExplainerModal = (props: MobileExplainerModalProps) => {
  const modalState = useOverlayTriggerState({});
  const { hasPremium } = props;
  const l10n = useL10n();

  const subdomainTooltipButton = (
    <button
      className={styles["info-icon"]}
      onClick={() => {
        modalState.open();
      }}
    >
      <InfoIcon
        alt={l10n.getString(
          hasPremium
            ? "tooltip-email-domain-explanation-title"
            : "tooltip-email-domain-explanation-title-free",
        )}
        width={18}
        height={18}
      />
    </button>
  );

  const subdomainExplanationBody = hasPremium ? (
    <>
      <p>{l10n.getString("tooltip-email-domain-explanation-part-one")}</p>
      <br />
      <p>{l10n.getString("tooltip-email-domain-explanation-part-two")}</p>
      <br />
      <p>
        <Localized
          id="tooltip-email-domain-explanation-part-three"
          vars={{ mozmail: "mozmail.com" }}
          elems={{
            p: <p />,
          }}
        >
          <span />
        </Localized>
      </p>
    </>
  ) : (
    <p>{l10n.getString("tooltip-email-domain-explanation-part-one-free")}</p>
  );

  const subdomainInfoModal = modalState.isOpen ? (
    <InfoModal
      isOpen={modalState.isOpen}
      onClose={() => modalState.close()}
      modalTitle={l10n.getString("tooltip-email-domain-explanation-title")}
      modalBodyText={subdomainExplanationBody}
    />
  ) : null;

  return (
    <>
      {subdomainTooltipButton}
      {subdomainInfoModal}
    </>
  );
};

export type ExplainerTriggerProps = {
  hasPremium: boolean;
};

const ExplainerTrigger = (props: ExplainerTriggerProps) => {
  const l10n = useL10n();
  const explainerState = useOverlayTriggerState({});
  const overlayRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { hasPremium } = props;

  const openButtonProps = useButton(
    { onPress: () => explainerState.open() },
    openButtonRef,
  ).buttonProps;
  const closeButtonProps = useButton(
    { onPress: () => explainerState.close() },
    closeButtonRef,
  ).buttonProps;

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
        className={styles["info-icon"]}
        {...openButtonProps}
        ref={openButtonRef}
      >
        <InfoIcon
          alt={
            explainerState.isOpen
              ? ""
              : l10n.getString(
                  hasPremium
                    ? "tooltip-email-domain-explanation-title"
                    : "tooltip-email-domain-explanation-title-free",
                )
          }
          width={18}
          height={18}
        />
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
            {hasPremium ? (
              <>
                <p>
                  {l10n.getString("tooltip-email-domain-explanation-part-one")}
                </p>
                <br />
                <p>
                  {l10n.getString("tooltip-email-domain-explanation-part-two")}
                </p>
                <br />
                <p>
                  <Localized
                    id="tooltip-email-domain-explanation-part-three"
                    vars={{ mozmail: "mozmail.com" }}
                    elems={{
                      p: <p />,
                    }}
                  >
                    <span />
                  </Localized>
                </p>
              </>
            ) : (
              <p>
                {l10n.getString(
                  "tooltip-email-domain-explanation-part-one-free",
                )}
              </p>
            )}
            <button
              {...closeButtonProps}
              ref={closeButtonRef}
              className={styles["close-button"]}
            >
              <CloseIcon
                alt={l10n.getString(
                  "popover-custom-alias-explainer-close-button-label",
                )}
              />
            </button>
          </Explainer>
        </OverlayContainer>
      }
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
      overlayRef as RefObject<HTMLDivElement>,
    );

    const { modalProps } = useModal();

    const { dialogProps, titleProps } = useDialog(
      {},
      overlayRef as RefObject<HTMLDivElement>,
    );

    // On small screens, this is a dialog at the top of the viewport.
    // On wider screens, it is a popover attached to the indicator:
    const positionProps = isWideScreen ? props.positionProps : {};
    const mergedOverlayProps = mergeProps(
      overlayProps,
      positionProps,
      dialogProps,
      modalProps,
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
            {l10n.getString("tooltip-email-domain-explanation-title")}
          </h3>
          {props.children}
        </div>
      </FocusScope>
    );
  },
);
