import { SVGProps } from "react";

/** Close button that inherits the text color of its container */
export const CloseIcon = ({alt, ...props}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      style={{
        fill: "currentcolor",
        ...props.style,
      }}
      {...props}
    >
      <title>{alt}</title>
      <path
        d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"
      ></path>
    </svg>
  );
};
