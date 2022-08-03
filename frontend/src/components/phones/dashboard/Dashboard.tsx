import { useRelayNumber } from "../../../hooks/api/relayNumber";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();

  if (relayNumberData.data && relayNumberData.data.length > 0) {
    return (
      <>
        Phone dashboard comes here! Your Relay phone mask is:{" "}
        {relayNumberData.data[0].number}
      </>
    );
  }
  return (
    <>
      Phone dashboard comes here! You&apos;ve got{" "}
      {relayNumberData.data?.length ?? 0} phone mask(s).
    </>
  );
};
