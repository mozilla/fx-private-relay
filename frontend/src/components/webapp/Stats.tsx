import { AriaMeterProps, useMeter } from "react-aria";
import styles from "./Stats.module.scss";
import { RelayNumber } from "../../hooks/api/relayNumber";
import { useL10n } from "../../hooks/l10n";
import { formatPhone } from "../../functions/formatPhone";

export type Props = {
  relayNumber: RelayNumber;
};

export const Stats = (props: Props) => {
  const l10n = useL10n();

  return (
    <div className={styles.wrapper}>
      <span className={styles.heading}>
        <span className={styles.number}>
          {formatPhone(props.relayNumber.number)}
        </span>
      </span>
      <ul className={styles.stats}>
        <li className={styles.stat}>
          <Meter
            value={props.relayNumber.remaining_minutes}
            maxValue={50}
            label={l10n.getString("phone-statistics-remaining-call-minutes")}
            formatOptions={{ style: "decimal" }}
          />
        </li>
        <li className={styles.stat}>
          <Meter
            value={props.relayNumber.remaining_texts}
            maxValue={75}
            label={l10n.getString("phone-statistics-remaining-texts")}
            formatOptions={{ style: "decimal" }}
          />
        </li>
      </ul>
    </div>
  );
};

const Meter = (
  props: AriaMeterProps & Required<Pick<AriaMeterProps, "value" | "maxValue">>
) => {
  const { meterProps, labelProps } = useMeter(props);

  const size = 150;
  const strokeWidth = 10;

  const circumference = 2 * (size / 2 - strokeWidth) * Math.PI;

  return (
    <div {...meterProps} className={styles.meter}>
      <svg
        role="presentation"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        strokeWidth={strokeWidth}
      >
        <circle
          className={styles.track}
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - strokeWidth}
          strokeDasharray={`${circumference * (270 / 360)} ${circumference}`}
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - strokeWidth}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={
            circumference -
            ((props.value - (props.minValue ?? 0)) /
              (props.maxValue - (props.minValue ?? 0))) *
              (circumference * (270 / 360))
          }
          transform={`rotate(135 ${size / 2} ${size / 2})`}
        />
        <text
          className={styles.value}
          x={size / 2}
          y={size / 2 + size / 16}
          fontSize={size / 4}
          textAnchor="middle"
        >
          {meterProps["aria-valuetext"]}
        </text>
      </svg>
      <span {...labelProps} className={styles.label}>
        {props.label}
      </span>
    </div>
  );
};
