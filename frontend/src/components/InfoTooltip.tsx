import { ReactNode, useRef } from "react";
import { useTooltip, useTooltipTrigger } from "@react-aria/tooltip";
import { useTooltipTriggerState } from "@react-stately/tooltip";
import { mergeProps } from "@react-aria/utils";
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
