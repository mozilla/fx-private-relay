import { useRelayNumber } from "../../../hooks/api/relayNumber";

export const PhoneDashboard = () => {
  const relayNumberData = useRelayNumber();

  return (
    <>
      Phone dashboard comes here! You&apos;ve got{" "}
      {relayNumberData.data?.length ?? 0} phone mask(s).
    </>
  );
};
