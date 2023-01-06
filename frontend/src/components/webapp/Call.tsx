import { apiFetch } from "../../hooks/api/api";
import { RelayNumber } from "../../hooks/api/relayNumber";
import { Dialer } from "./Dialer";

export type Props = {
  relayNumber: RelayNumber;
};

export const Call = (props: Props) => {
  return (
    <>
      <Dialer onCall={(number) => call(number)} />
    </>
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
