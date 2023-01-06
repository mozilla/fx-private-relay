import { useState } from "react";
import { formatPhone } from "../../functions/formatPhone";
import { useL10n } from "../../hooks/l10n";
import styles from "./Dialer.module.scss";

export type Props = {
  onCall: (number: string) => void;
};

export const Dialer = (props: Props) => {
  const l10n = useL10n();
  const [number, setNumber] = useState("");

  const press = (number: number) => {
    setNumber((oldNumber) => oldNumber + number.toString());
  };

  return (
    <div className={styles.wrapper}>
      <output className={styles.display}>{formatPhone(number)}</output>
      <div className={styles.numpad}>
        <div className={styles.number}>
          <button onClick={() => press(1)}>1</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(2)}>2</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(3)}>3</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(4)}>4</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(5)}>5</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(6)}>6</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(7)}>7</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(8)}>8</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(9)}>9</button>
        </div>
        <div className={styles.number}>
          <button onClick={() => press(0)}>0</button>
        </div>
      </div>
      <button
        onClick={() => props.onCall("+1" + number)}
        className={styles.call}
      >
        {l10n.getString("dialer-dial-label")}
      </button>
    </div>
  );
};
