declare module "react-qr-scanner" {
  import { FunctionComponent, ReactElement } from "react";

  export type ScanResult = {
    text: string;
    format: number;
    numBits: number;
    rawBytes: Uint8Array;
    resultPoints: Array<{
      x: number;
      y: number;
      estimatedModuleSize: number;
      count: number;
    }>;
    timestamp: number;
    canvas: ReactElement<HTMLCanvasElement>;
  };

  export type QrReaderProps = {
    onScan: (value: ScanResult | null) => void;
    onError: (error: unknown) => void;
    delay?: number;
    onLoad?: () => void;
    facingMode?: "front" | "rear";
    className?: string;
  } & (
    | { legacyMode?: false }
    | { legacyMode?: true; onImageLoad?: () => void; maxImageSize?: number }
  );

  const QrReader: FunctionComponent<QrReaderProps>;

  export default QrReader;
}
