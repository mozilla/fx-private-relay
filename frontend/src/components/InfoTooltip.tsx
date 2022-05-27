import { ReactNode, useRef } from "react";
import { useTooltip, useTooltipTrigger, mergeProps } from "react-aria";
import { useTooltipTriggerState } from "react-stately";
import styles from "./InfoTooltip.module.scss";
import { InfoIcon } from "./Icons";

export type Props = {
  children: ReactNode;
  alt: string;
};

export const InfoTooltip = (props: Props) => {
  const tooltipTriggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const tooltipTrigger = useTooltipTrigger({}, tooltipTriggerState, triggerRef);
  const { tooltipProps } = useTooltip(
    tooltipTrigger.tooltipProps,
    tooltipTriggerState
  );

  return (
    <span className={styles.wrapper}>
      <button
        ref={triggerRef}
        // Set to type="button" to prevent wrapping forms from being submitted
        // when the info icon is clicked:
        type="button"
        {...tooltipTrigger.triggerProps}
        className={styles.trigger}
      >
        <InfoIcon alt={props.alt} width={18} height={18} />
      </button>
      {tooltipTriggerState.isOpen && (
        <span
          className={styles.tooltip}
          {...mergeProps(tooltipTrigger.tooltipProps, tooltipProps)}
        >
          {props.children}
        </span>
      )}
    </span>
  );
};
