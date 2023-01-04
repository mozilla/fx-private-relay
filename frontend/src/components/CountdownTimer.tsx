import { useL10n } from "../hooks/l10n";
import styles from "./CountdownTimer.module.scss";

export type Props = {
  remainingTimeInMs: number;
};

export const CountdownTimer = (props: Props) => {
  const l10n = useL10n();

  const { remainingDays, remainingHours, remainingMinutes, remainingSeconds } =
    getRemainingTimeParts(props.remainingTimeInMs);

  return (
    <figure className={styles["countdown-timer"]}>
      <time
        dateTime={`P${remainingDays}DT${remainingHours}H`}
        aria-label={l10n.getString("offer-countdown-timer-alt", {
          remaining_days: remainingDays,
          remaining_hours: remainingHours,
        })}
      >
        <dl>
          <div>
            <dt>{l10n.getString("offer-countdown-timer-days")}</dt>
            <dd>{remainingDays}</dd>
          </div>
          <div>
            <dt>{l10n.getString("offer-countdown-timer-hours")}</dt>
            <dd>{remainingHours}</dd>
          </div>
          <div>
            <dt>{l10n.getString("offer-countdown-timer-minutes")}</dt>
            <dd>{remainingMinutes}</dd>
          </div>
          <div className={styles["remaining-seconds"]}>
            <dt>{l10n.getString("offer-countdown-timer-seconds")}</dt>
            <dd>{remainingSeconds}</dd>
          </div>
        </dl>
      </time>
    </figure>
  );
};

export function getRemainingTimeParts(remainingMilliseconds: number) {
  const remainingDays = Math.floor(
    remainingMilliseconds / (1000 * 60 * 60 * 24)
  );
  const remainingHours = Math.floor(
    (remainingMilliseconds - remainingDays * (1000 * 60 * 60 * 24)) /
      (1000 * 60 * 60)
  );
  const remainingMinutes = Math.floor(
    (remainingMilliseconds -
      remainingDays * (1000 * 60 * 60 * 24) -
      remainingHours * (1000 * 60 * 60)) /
      (1000 * 60)
  );
  const remainingSeconds = Math.floor(
    (remainingMilliseconds -
      remainingDays * (1000 * 60 * 60 * 24) -
      remainingHours * (1000 * 60 * 60) -
      remainingMinutes * (1000 * 60)) /
      1000
  );

  return {
    remainingDays,
    remainingHours,
    remainingMinutes,
    remainingSeconds,
  };
}
