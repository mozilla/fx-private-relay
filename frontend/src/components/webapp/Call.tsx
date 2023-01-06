import { RelayNumber } from "../../hooks/api/relayNumber";
import { Dialer } from "./Dialer";

export type Props = {
  relayNumber: RelayNumber;
};

export const Call = (props: Props) => {
  return (
    <>
      <Dialer onCall={(number) => console.log({ number })} />
    </>
  );
};
