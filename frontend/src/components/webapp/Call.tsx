import styles from "./Call.module.scss";
import { apiFetch } from "../../hooks/api/api";
import { RelayNumber } from "../../hooks/api/relayNumber";
import { Dialer } from "./Dialer";

export type Props = {
  relayNumber: RelayNumber;
};

export const Call = (props: Props) => {
  return (
    <div className={styles.wrapper}>
      <Dialer onCall={(number) => call(number)} />
    </div>
  );
};

async function call(number: string) {
  return apiFetch("/call/", {
    method: "POST",
    body: JSON.stringify({
      to: number,
    }),
  });
}
