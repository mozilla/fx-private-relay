// Note: ideally, the Nebula icons are made available in a repository somewhere,
//       then added to react-icons: https://react-icons.github.io/react-icons/.
//       These manually-created components are a workaround until that is done.

import { useLocalization } from "@fluent/react";
import { SVGProps } from "react";

/** Info button that inherits the text color of its container */
export const InfoIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width={28}
      height={28}
      style={{
        fill: "currentcolor",
        ...props.style,
      }}
      {...props}
    >
      <title>{alt}</title>
      <path d="M12.666 7.33342H15.3327V10.0001H12.666V7.33342ZM12.666 12.6667H15.3327V20.6667H12.666V12.6667ZM13.9993 0.666748C6.63935 0.666748 0.666016 6.64008 0.666016 14.0001C0.666016 21.3601 6.63935 27.3334 13.9993 27.3334C21.3594 27.3334 27.3327 21.3601 27.3327 14.0001C27.3327 6.64008 21.3594 0.666748 13.9993 0.666748ZM13.9993 24.6667C8.11935 24.6667 3.33268 19.8801 3.33268 14.0001C3.33268 8.12008 8.11935 3.33341 13.9993 3.33341C19.8793 3.33341 24.666 8.12008 24.666 14.0001C24.666 19.8801 19.8793 24.6667 13.9993 24.6667Z"></path>
    </svg>
  );
};

/** Close button that inherits the text color of its container */
export const CloseIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
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
      <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"></path>
    </svg>
  );
};

/** Icon to indicate links that open in a new tab, that inherits the text color of its container */
export const NewTabIcon = (
  props: SVGProps<SVGSVGElement> & { alt?: string }
) => {
  const { l10n } = useLocalization();

  return (
    <svg
      role="img"
      aria-label={props.alt ?? l10n.getString("common-link-newtab-alt")}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      style={{
        fill: "currentcolor",
        ...props.style,
      }}
      {...props}
    >
      <title>{props.alt ?? l10n.getString("common-link-newtab-alt")}</title>
      <path d="M5 1H4a3 3 0 00-3 3v8a3 3 0 003 3h8a3 3 0 003-3v-1a1 1 0 00-2 0v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h1a1 1 0 100-2z" />
      <path d="M14.935 1.618A1 1 0 0014.012 1h-5a1 1 0 100 2h2.586L8.305 6.293A1 1 0 109.72 7.707l3.293-3.293V7a1 1 0 102 0V2a1 1 0 00-.077-.382z" />
    </svg>
  );
};

export const Cogwheel = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.9 7H15C15.5523 7 16 7.44772 16 8C16 8.55229 15.5523 9 15 9H12.9C12.7709 9.62641 12.522 10.222 12.167 10.754L13.657 12.244C14.036 12.6364 14.0306 13.2601 13.6448 13.6458C13.2591 14.0316 12.6354 14.037 12.243 13.658L10.753 12.168C10.2212 12.5225 9.62598 12.771 9 12.9V15C9 15.5523 8.55229 16 8 16C7.44772 16 7 15.5523 7 15V12.9C6.36976 12.7705 5.77066 12.5199 5.236 12.162C5.23047 12.1685 5.22642 12.1758 5.22239 12.183C5.21769 12.1915 5.21301 12.2 5.206 12.207L3.756 13.657C3.50493 13.917 3.13312 14.0212 2.78349 13.9297C2.43386 13.8382 2.16082 13.5651 2.0693 13.2155C1.97779 12.8659 2.08204 12.4941 2.342 12.243L3.792 10.793C3.79865 10.7863 3.80662 10.7821 3.81468 10.7777C3.82238 10.7735 3.83017 10.7693 3.837 10.763C3.47957 10.2286 3.22927 9.62982 3.1 9H1C0.447715 9 0 8.55228 0 8C0 7.44772 0.447715 7 1 7H3.1C3.22925 6.37394 3.47814 5.77872 3.833 5.247L2.343 3.757C1.95226 3.36653 1.95203 2.73324 2.3425 2.3425C2.73297 1.95176 3.36626 1.95153 3.757 2.342L5.247 3.832C5.77881 3.47751 6.37402 3.22897 7 3.1V1C7 0.447715 7.44772 0 8 0C8.55229 0 9 0.447715 9 1V3.1C9.6264 3.22915 10.222 3.47804 10.754 3.833L12.244 2.343C12.6364 1.96403 13.2601 1.96945 13.6458 2.35518C14.0316 2.74092 14.037 3.36462 13.658 3.757L12.168 5.247C12.5225 5.7788 12.7711 6.37401 12.9 7ZM8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5Z"
      fill="#3D3D3D"
    />
  </svg>
);

export const Logout = () => (
  <svg xmlns="http://www.w3.org/2000/svg">
    <path
      fill="#20123a"
      d="M9.21 11.71l4-4a1 1 0 00.22-.33 1 1 0 00.07-.25.94.94 0 000-.13.94.94 0 000-.13 1 1 0 00-.05-.25 1 1 0 00-.22-.33l-4-4a1.011 1.011 0 00-1.44 1.42L10.08 6H4.5a1 1 0 000 2h5.59l-2.3 2.29A1 1 0 009.2 11.7z"
    />
    <path
      fill="#20123a"
      d="M7 13a1 1 0 00-1-1H2V2h4a1 1 0 000-2H1.2A1.2 1.2 0 000 1.2v11.6A1.2 1.2 0 001.2 14H6a1 1 0 001-1z"
    />
  </svg>
);
