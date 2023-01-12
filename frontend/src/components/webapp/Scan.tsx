import { useState } from "react";
import QrReader, { ScanResult } from "react-qr-scanner";
import { useL10n } from "../../hooks/l10n";
import { Button } from "../Button";

export type Props = {
  onScan: (authToken: string) => void;
};

/**
 * Scan a QR code containing a Relay API token.
 *
 * Note that the QR scanner is rather heavy and thus lazily loaded; make sure to
 * wrap this component in a `<Suspense>` to show a loading state.
 * See https://reactjs.org/docs/code-splitting.html#reactlazy.
 */
export const Scan = (props: Props) => {
  const l10n = useL10n();
  const [isScanning, setIsScanning] = useState(false);

  const onScan = (value: ScanResult | null) => {
    if (value === null) {
      return;
    }
    props.onScan(
      value.text.substring(
        (document.location.origin + `/webapp/?apiToken=`).length
      )
    );
  };

  const scanner = isScanning ? (
    <QrReader
      onScan={onScan}
      // TODO: Proper error handling
      onError={(e) => console.log("Error", e)}
      facingMode="rear"
    />
  ) : (
    <Button onClick={() => setIsScanning(true)}>
      {l10n.getString("setting-api-key-qr-scan-start")}
    </Button>
  );

  return (
    <>
      <p>{l10n.getString("setting-api-key-qr-scan-lead")}</p>
      {scanner}
    </>
  );
};
