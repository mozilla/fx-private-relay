// Work around next.js adding inline style color:transparent
// This breaks our CSP rules about inline styles.
// More context and some suggested solutions from:
// https://0xdbe.github.io/NextJS-CSP-NextImage/
//
// If this is fixed in a future next.js release, replace:
// import Image from "../path/to/Image";
// with
// import Image from next/image;

import NextImage, { getImageProps } from "next/image";
import { ComponentProps } from "react";
import styles from "./Image.module.scss";

export default function Image(props: ComponentProps<typeof NextImage>) {
  const altText = props.alt;
  const { props: nextProps } = getImageProps({ ...props });
  const { style, className: origClassName, ...delegated } = nextProps;
  const debugStyles = false; // Set to true to fail build on new inline styles

  let className = origClassName || "";
  if (typeof style === "object" && style !== null) {
    if (Object.keys(style).length === 1 && style.color === "transparent") {
      className = `${className} ${styles.transparent}`.trim();
    } else if (debugStyles) {
      throw new Error(
        `Update components/Image.tsx, unexpected style value: ${JSON.stringify(style)}`,
      );
    }
  }

  if (className !== "") {
    return <img className={className} {...delegated} alt={altText} />;
  } else {
    return <img {...delegated} alt={altText} />;
  }
}
