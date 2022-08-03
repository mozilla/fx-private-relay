import { useRelayNumber } from "../../../hooks/api/relayNumber";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();

  return (
    <main>
      Phone dashboard comes here! Your Relay phone mask is{" "}
      <samp>{relayNumberData.data?.[0]?.number ?? "still loading"}</samp>.
    </main>
  );
};
