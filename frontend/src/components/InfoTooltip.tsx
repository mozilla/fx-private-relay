import { ReactNode, useRef } from "react";
import { useTooltip, useTooltipTrigger, mergeProps } from "react-aria";
import { useTooltipTriggerState } from "react-stately";
import styles from "./InfoTooltip.module.scss";
import { InfoIcon } from "./Icons";

export type Props = {
  children: ReactNode;
  alt: string;
  iconColor: string;
};

export const InfoTooltip = (props: Props) => {
  const tooltipTriggerState = useTooltipTriggerState({ delay: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const tooltipTrigger = useTooltipTrigger({}, tooltipTriggerState, triggerRef);
  const { tooltipProps } = useTooltip(
    tooltipTrigger.tooltipProps,
    tooltipTriggerState,
  );

  return (
    <span className={styles.wrapper}>
      <span
        ref={triggerRef}
        {...tooltipTrigger.triggerProps}
        className={styles.trigger}
      >
        <InfoIcon
          alt={props.alt}
          color={props.iconColor}
          width={18}
          height={18}
        />
      </span>
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
