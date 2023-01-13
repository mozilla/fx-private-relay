import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";
import styles from "./Scan.module.scss";
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
  const [message, setMessage] = useState<string>();
  const videoElemRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isScanning || !videoElemRef.current) {
      return;
    }

    const scanner = new QrScanner(
      videoElemRef.current,
      (result) => {
        const prefix = document.location.origin + `/webapp/?apiToken=`;
        if (result.data.substring(0, prefix.length) !== prefix) {
          throw new Error("Invalid prefix");
        }
        props.onScan(result.data.substring(prefix.length));
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        onDecodeError: (_error) => {
          setMessage(l10n.getString("setting-api-key-qr-scan-failed"));
        },
      }
    );
    scanner.start();

    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, [isScanning, l10n, props]);

  return (
    <>
      <p>{l10n.getString("setting-api-key-qr-scan-lead")}</p>
      <Button onClick={() => setIsScanning(!isScanning)}>
        {l10n.getString("setting-api-key-qr-scan-start")}
      </Button>
      {message && <p className={styles.error}>{message}</p>}
      <video ref={videoElemRef}></video>
    </>
  );
};
