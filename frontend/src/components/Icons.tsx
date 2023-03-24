// Note: ideally, the Nebula icons are made available in a repository somewhere,
//       then added to react-icons: https://react-icons.github.io/react-icons/.
//       These manually-created components are a workaround until that is done.

import { SVGProps } from "react";
import { useL10n } from "../hooks/l10n";
import styles from "./Icons.module.scss";

/** Info button that inherits the text color of its container */
export const InfoIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 28 28"
      width={28}
      height={28}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M12.666 7.33342H15.3327V10.0001H12.666V7.33342ZM12.666 12.6667H15.3327V20.6667H12.666V12.6667ZM13.9993 0.666748C6.63935 0.666748 0.666016 6.64008 0.666016 14.0001C0.666016 21.3601 6.63935 27.3334 13.9993 27.3334C21.3594 27.3334 27.3327 21.3601 27.3327 14.0001C27.3327 6.64008 21.3594 0.666748 13.9993 0.666748ZM13.9993 24.6667C8.11935 24.6667 3.33268 19.8801 3.33268 14.0001C3.33268 8.12008 8.11935 3.33341 13.9993 3.33341C19.8793 3.33341 24.666 8.12008 24.666 14.0001C24.666 19.8801 19.8793 24.6667 13.9993 24.6667Z"></path>
    </svg>
  );
};

/** Filled info button that inherits the text color of its container */
export const WarningFilledIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" />
    </svg>
  );
};

export const InfoFilledIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V9H11V15ZM11 7H9V5H11V7Z" />
    </svg>
  );
};

/** Triangular info button that inherits the text color of its container */
export const InfoTriangleIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 15"
      width={18}
      height={15}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M0.75 14.75H17.25L9 0.5L0.75 14.75ZM9.75 12.5H8.25V11H9.75V12.5ZM9.75 9.5H8.25V6.5H9.75V9.5Z" />
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
      aria-hidden={alt === ""}
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"></path>
    </svg>
  );
};

/** Bento button that inherits the text color of its container */
export const BentoIcon = (
  props: SVGProps<SVGSVGElement> & { alt?: string }
) => {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      role="img"
      aria-label={props.alt}
      aria-hidden={props.alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{props.alt}</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.5 2.5C1.5 1.94772 1.94772 1.5 2.5 1.5H6.5C7.05228 1.5 7.5 1.94772 7.5 2.5V6.5C7.5 7.05228 7.05228 7.5 6.5 7.5H2.5C1.94772 7.5 1.5 7.05228 1.5 6.5V2.5ZM9 2.5C9 1.94772 9.44772 1.5 10 1.5H14C14.5523 1.5 15 1.94772 15 2.5V6.5C15 7.05228 14.5523 7.5 14 7.5H10C9.44772 7.5 9 7.05228 9 6.5V2.5ZM17.5 1.5C16.9477 1.5 16.5 1.94772 16.5 2.5V6.5C16.5 7.05228 16.9477 7.5 17.5 7.5H21.5C22.0523 7.5 22.5 7.05228 22.5 6.5V2.5C22.5 1.94772 22.0523 1.5 21.5 1.5H17.5ZM1.5 10C1.5 9.44772 1.94772 9 2.5 9H6.5C7.05228 9 7.5 9.44772 7.5 10V14C7.5 14.5523 7.05228 15 6.5 15H2.5C1.94772 15 1.5 14.5523 1.5 14V10ZM10 9C9.44772 9 9 9.44772 9 10V14C9 14.5523 9.44772 15 10 15H14C14.5523 15 15 14.5523 15 14V10C15 9.44772 14.5523 9 14 9H10ZM16.5 10C16.5 9.44772 16.9477 9 17.5 9H21.5C22.0523 9 22.5 9.44772 22.5 10V14C22.5 14.5523 22.0523 15 21.5 15H17.5C16.9477 15 16.5 14.5523 16.5 14V10ZM2.5 16.5C1.94772 16.5 1.5 16.9477 1.5 17.5V21.5C1.5 22.0523 1.94772 22.5 2.5 22.5H6.5C7.05228 22.5 7.5 22.0523 7.5 21.5V17.5C7.5 16.9477 7.05228 16.5 6.5 16.5H2.5ZM9 17.5C9 16.9477 9.44772 16.5 10 16.5H14C14.5523 16.5 15 16.9477 15 17.5V21.5C15 22.0523 14.5523 22.5 14 22.5H10C9.44772 22.5 9 22.0523 9 21.5V17.5ZM17.5 16.5C16.9477 16.5 16.5 16.9477 16.5 17.5V21.5C16.5 22.0523 16.9477 22.5 17.5 22.5H21.5C22.0523 22.5 22.5 22.0523 22.5 21.5V17.5C22.5 16.9477 22.0523 16.5 21.5 16.5H17.5Z"
      />
    </svg>
  );
};

/** Icon to indicate links that open in a new tab, that inherits the text color of its container */
export const NewTabIcon = (
  props: SVGProps<SVGSVGElement> & { alt?: string }
) => {
  const l10n = useL10n();

  return (
    <svg
      role="img"
      aria-label={props.alt ?? l10n.getString("common-link-newtab-alt")}
      aria-hidden={props.alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{props.alt ?? l10n.getString("common-link-newtab-alt")}</title>
      <path d="M5 1H4a3 3 0 00-3 3v8a3 3 0 003 3h8a3 3 0 003-3v-1a1 1 0 00-2 0v1a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1h1a1 1 0 100-2z" />
      <path d="M14.935 1.618A1 1 0 0014.012 1h-5a1 1 0 100 2h2.586L8.305 6.293A1 1 0 109.72 7.707l3.293-3.293V7a1 1 0 102 0V2a1 1 0 00-.077-.382z" />
    </svg>
  );
};

// Keywords: news, whats new, whatsnew, present
export const GiftIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      width={14}
      height={15}
      viewBox="0 0 14 15"
      role="img"
      aria-hidden={alt === ""}
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M1 13.6155C0.998668 13.7787 1.02983 13.9406 1.09168 14.0916C1.15352 14.2426 1.24481 14.3799 1.36022 14.4953C1.47563 14.6107 1.61286 14.702 1.7639 14.7638C1.91495 14.8257 2.07679 14.8568 2.24 14.8555H6V8.8555H1V13.6155ZM8 8.8555V14.8555H11.76C11.9232 14.8568 12.0851 14.8257 12.2361 14.7638C12.3871 14.702 12.5244 14.6107 12.6398 14.4953C12.7552 14.3799 12.8465 14.2426 12.9083 14.0916C12.9702 13.9406 13.0013 13.7787 13 13.6155V8.8555H8ZM0 4.8555V7.8555H6V3.8555H1C0.734784 3.8555 0.48043 3.96086 0.292893 4.14839C0.105357 4.33593 0 4.59028 0 4.8555ZM13 3.8555H8V7.8555H14V4.8555C14 4.59028 13.8946 4.33593 13.7071 4.14839C13.5196 3.96086 13.2652 3.8555 13 3.8555ZM9.05 0.2655C8.8844 0.142106 8.69252 0.0586563 8.48934 0.021668C8.28617 -0.0153203 8.07719 -0.00484652 7.87873 0.0522715C7.68027 0.10939 7.49769 0.211606 7.34526 0.35094C7.19283 0.490274 7.07467 0.662955 7 0.8555C6.92209 0.671991 6.80451 0.508015 6.6557 0.375351C6.50689 0.242687 6.33054 0.144628 6.13932 0.0882202C5.94811 0.0318119 5.74677 0.0184539 5.54978 0.0491059C5.35279 0.079758 5.16503 0.153659 5 0.2655C4.2 0.9355 3.91 2.3355 7 3.8555C10.09 2.3355 9.8 0.9355 9.05 0.2655Z" />
    </svg>
  );
};

/** Icon to indicate there is a menu */
export const MenuIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      role="img"
      aria-hidden={alt === ""}
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M1.33333 2.66667H14.6667C15.0203 2.66667 15.3594 2.52619 15.6095 2.27614C15.8595 2.02609 16 1.68696 16 1.33333C16 0.979711 15.8595 0.640573 15.6095 0.390524C15.3594 0.140476 15.0203 0 14.6667 0H1.33333C0.979711 0 0.640573 0.140476 0.390524 0.390524C0.140476 0.640573 0 0.979711 0 1.33333C0 1.68696 0.140476 2.02609 0.390524 2.27614C0.640573 2.52619 0.979711 2.66667 1.33333 2.66667ZM14.6667 6.66667H1.33333C0.979711 6.66667 0.640573 6.80714 0.390524 7.05719C0.140476 7.30724 0 7.64638 0 8C0 8.35362 0.140476 8.69276 0.390524 8.94281C0.640573 9.19286 0.979711 9.33333 1.33333 9.33333H14.6667C15.0203 9.33333 15.3594 9.19286 15.6095 8.94281C15.8595 8.69276 16 8.35362 16 8C16 7.64638 15.8595 7.30724 15.6095 7.05719C15.3594 6.80714 15.0203 6.66667 14.6667 6.66667ZM14.6667 13.3333H1.33333C0.979711 13.3333 0.640573 13.4738 0.390524 13.7239C0.140476 13.9739 0 14.313 0 14.6667C0 15.0203 0.140476 15.3594 0.390524 15.6095C0.640573 15.8595 0.979711 16 1.33333 16H14.6667C15.0203 16 15.3594 15.8595 15.6095 15.6095C15.8595 15.3594 16 15.0203 16 14.6667C16 14.313 15.8595 13.9739 15.6095 13.7239C15.3594 13.4738 15.0203 13.3333 14.6667 13.3333Z" />
    </svg>
  );
};

/** Lock icon that inherits the text color of its container */
export const LockIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  const width = props.width ?? 14;
  const height = props.height ?? 16;

  return (
    <svg
      role="img"
      aria-label={alt}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden={alt === ""}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M12.031 6.84h-.573V4.57a4.566 4.566 0 00-1.342-3.232 4.59 4.59 0 00-6.482 0A4.565 4.565 0 002.292 4.57V6.84h-.573c-.456 0-.893.18-1.216.502A1.712 1.712 0 000 8.554v5.732c0 .454.181.89.503 1.212.323.321.76.502 1.216.502H12.03a1.712 1.712 0 001.719-1.714V8.554c0-.455-.181-.89-.503-1.212a1.721 1.721 0 00-1.216-.502zM4.583 4.57c0-.606.242-1.187.672-1.616a2.295 2.295 0 013.24 0c.43.429.672 1.01.672 1.616V6.84H4.583V4.57z" />
    </svg>
  );
};

/** Icon to indicate the ability to copy something to your clipboard, that inherits the text color of its container */
export const CopyIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M14.707 8.293l-3-3A1 1 0 0011 5h-1V4a1 1 0 00-.293-.707l-3-3A1 1 0 006 0H3a2 2 0 00-2 2v7a2 2 0 002 2h3v3a2 2 0 002 2h5a2 2 0 002-2V9a1 1 0 00-.293-.707zM12.586 9H11V7.414zm-5-5H6V2.414zM6 7v2H3V2h2v2.5a.5.5 0 00.5.5H8a2 2 0 00-2 2zm2 7V7h2v2.5a.5.5 0 00.5.5H13v4z" />
    </svg>
  );
};

/** Icon of an arrow pointing down, that inherits the text color of its container */
export const ArrowDownIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M8 12a1 1 0 01-.707-.293l-5-5a1 1 0 011.414-1.414L8 9.586l4.293-4.293a1 1 0 011.414 1.414l-5 5A1 1 0 018 12z" />
    </svg>
  );
};

/** Icon of plus sign, that inherits the text color of its container */
export const PlusIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M14 7H9V2a1 1 0 00-2 0v5H2a1 1 0 100 2h5v5a1 1 0 002 0V9h5a1 1 0 000-2z" />
    </svg>
  );
};

/** Icon for searches, that inherits the text color of its container */
export const SearchIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
    >
      <title>{alt}</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 16C3.58172 16 0 12.4183 0 8C0 3.58172 3.58172 0 8 0C12.4183 0 16 3.58172 16 8C16 9.84872 15.3729 11.551 14.3199 12.9057L19.7071 18.2929C20.0976 18.6834 20.0976 19.3166 19.7071 19.7071C19.3166 20.0976 18.6834 20.0976 18.2929 19.7071L12.9056 14.3199C11.551 15.3729 9.84871 16 8 16ZM8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.23077"
      />
      <path
        d="M13 13L19 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.23077"
        strokeLinecap="round"
      />
    </svg>
  );
};

/** Icon for the filter button, that inherits the text color of its container */
export const FilterIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10 18H14V16H10V18ZM3 6V8H21V6H3ZM6 13H18V11H6V13Z" />
    </svg>
  );
};

/** Check icon that inherits the text color of its container */
export const CheckIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width={16}
      height={16}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M5.31695 15.9896C4.96336 15.9895 4.62427 15.849 4.37428 15.5989L0.374282 11.5989C0.131405 11.3475 -0.00298749 11.0107 5.04035e-05 10.6611C0.0030883 10.3115 0.143314 9.97705 0.390524 9.72984C0.637735 9.48263 0.972152 9.3424 1.32175 9.33937C1.67134 9.33633 2.00815 9.47072 2.25962 9.7136L5.13562 12.5896L13.5569 0.558929C13.7611 0.272858 14.0698 0.0789328 14.4162 0.0193255C14.7625 -0.0402818 15.1184 0.0392486 15.4064 0.240622C15.6944 0.441996 15.8912 0.748929 15.9541 1.09467C16.017 1.44042 15.9409 1.79702 15.7423 2.08693L6.40895 15.4203C6.29787 15.5808 6.15289 15.715 5.98424 15.8134C5.81559 15.9118 5.62739 15.9719 5.43295 15.9896C5.39431 15.9915 5.35559 15.9915 5.31695 15.9896Z" />
    </svg>
  );
};

/** Check circle icon that inherits the text color of its container */
export const CheckCircleIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={24}
      height={24}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path
        d="M12 0C5.376 0 0 5.376 0 12C0 18.624 5.376 24 12 24C18.624 24 24 18.624 24 12C24 5.376 18.624 0 12 0ZM9.6 18L3.6 12L5.292 10.308L9.6 14.604L18.708 5.496L20.4 7.2L9.6 18Z"
        fill="#3AD4B3"
      />
    </svg>
  );
};

/** Check badge icon that inherits the text color of its container */
export const CheckBadgeIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width={18}
      height={18}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M17.25 9L15.42 6.9075L15.675 4.14L12.9675 3.525L11.55 1.125L9 2.22L6.45 1.125L5.0325 3.5175L2.325 4.125L2.58 6.9L0.75 9L2.58 11.0925L2.325 13.8675L5.0325 14.4825L6.45 16.875L9 15.7725L11.55 16.8675L12.9675 14.475L15.675 13.86L15.42 11.0925L17.25 9ZM7.5675 12.54L4.7175 9.6825L5.8275 8.5725L7.5675 10.32L11.955 5.9175L13.065 7.0275L7.5675 12.54Z" />
    </svg>
  );
};

/** Icon for links to the status page, that inherits the text color of its container */
export const PerformanceIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 18 18"
      width={18}
      height={18}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3.8168 3.81705C5.19159 2.44226 7.05559 1.66894 8.99984 1.66676C10.2376 1.66487 11.4556 1.97678 12.5401 2.57332C13.6246 3.16987 14.5401 4.03159 15.2013 5.07797C15.8624 6.12435 16.2475 7.32124 16.3205 8.55682C16.3936 9.7924 16.1523 11.0263 15.6191 12.1433C15.5674 12.2521 15.4949 12.3496 15.4056 12.4303C15.3162 12.5111 15.2119 12.5734 15.0984 12.6138C14.985 12.6542 14.8648 12.6718 14.7445 12.6657C14.6243 12.6597 14.5064 12.6299 14.3976 12.5783C14.2889 12.5267 14.1913 12.4541 14.1106 12.3648C14.0299 12.2754 13.9676 12.1711 13.9272 12.0577C13.8868 11.9442 13.8691 11.824 13.8752 11.7037C13.8813 11.5835 13.911 11.4656 13.9627 11.3568C14.3188 10.6114 14.5023 9.79532 14.4998 8.9692C14.4972 8.14308 14.3086 7.32815 13.948 6.58492C13.5873 5.84169 13.0638 5.18926 12.4164 4.67607C11.769 4.16289 11.0143 3.80213 10.2084 3.6206C9.40248 3.43906 8.56601 3.44141 7.76112 3.62747C6.95622 3.81353 6.20357 4.17852 5.55907 4.69533C4.91457 5.21214 4.39478 5.86751 4.03828 6.61275C3.68178 7.35799 3.49775 8.17397 3.49984 9.00009C3.49857 9.81526 3.68026 10.6203 4.03151 11.3559C4.09375 11.4654 4.13279 11.5864 4.14619 11.7116C4.15959 11.8368 4.14705 11.9634 4.10938 12.0835C4.0717 12.2036 4.00968 12.3147 3.92719 12.4098C3.84469 12.5049 3.7435 12.582 3.6299 12.6363C3.51631 12.6905 3.39275 12.7208 3.26694 12.7253C3.14112 12.7297 3.01574 12.7081 2.89862 12.662C2.78149 12.6158 2.67513 12.546 2.58616 12.457C2.49719 12.3679 2.42753 12.2614 2.38151 12.1443C1.91041 11.1631 1.66605 10.0885 1.6665 9.00009C1.66869 7.05584 2.44201 5.19185 3.8168 3.81705ZM12.1095 7.17745C12.2281 7.15115 12.3523 7.17301 12.4548 7.23823C12.5567 7.30398 12.6285 7.40749 12.6542 7.52606C12.68 7.64462 12.6577 7.76857 12.5923 7.87073L10.3345 11.4191C10.6242 11.7177 10.8009 12.1078 10.8344 12.5224C10.8678 12.9371 10.7559 13.3504 10.5178 13.6916C10.386 13.8867 10.2179 14.0547 10.0228 14.1866C9.76509 14.3609 9.46721 14.4667 9.15725 14.4941C8.84729 14.5216 8.53545 14.4696 8.25111 14.3432C7.96676 14.2168 7.71927 14.0202 7.53192 13.7717C7.34458 13.5233 7.22356 13.2312 7.18026 12.9231C7.13696 12.6149 7.1728 12.3008 7.28441 12.0104C7.39601 11.7199 7.57972 11.4626 7.81821 11.2628C8.05671 11.0629 8.34216 10.927 8.64766 10.868C8.95317 10.8089 9.26869 10.8285 9.56451 10.9251L11.8223 7.37848C11.8876 7.27605 11.9909 7.20375 12.1095 7.17745Z"
      />
    </svg>
  );
};

export const Cogwheel = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt?: string }) => (
  <svg
    role="img"
    aria-label={alt}
    aria-hidden={alt === ""}
    width={16}
    height={16}
    viewBox="0 0 16 16"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12.9 7H15C15.5523 7 16 7.44772 16 8C16 8.55229 15.5523 9 15 9H12.9C12.7709 9.62641 12.522 10.222 12.167 10.754L13.657 12.244C14.036 12.6364 14.0306 13.2601 13.6448 13.6458C13.2591 14.0316 12.6354 14.037 12.243 13.658L10.753 12.168C10.2212 12.5225 9.62598 12.771 9 12.9V15C9 15.5523 8.55229 16 8 16C7.44772 16 7 15.5523 7 15V12.9C6.36976 12.7705 5.77066 12.5199 5.236 12.162C5.23047 12.1685 5.22642 12.1758 5.22239 12.183C5.21769 12.1915 5.21301 12.2 5.206 12.207L3.756 13.657C3.50493 13.917 3.13312 14.0212 2.78349 13.9297C2.43386 13.8382 2.16082 13.5651 2.0693 13.2155C1.97779 12.8659 2.08204 12.4941 2.342 12.243L3.792 10.793C3.79865 10.7863 3.80662 10.7821 3.81468 10.7777C3.82238 10.7735 3.83017 10.7693 3.837 10.763C3.47957 10.2286 3.22927 9.62982 3.1 9H1C0.447715 9 0 8.55228 0 8C0 7.44772 0.447715 7 1 7H3.1C3.22925 6.37394 3.47814 5.77872 3.833 5.247L2.343 3.757C1.95226 3.36653 1.95203 2.73324 2.3425 2.3425C2.73297 1.95176 3.36626 1.95153 3.757 2.342L5.247 3.832C5.77881 3.47751 6.37402 3.22897 7 3.1V1C7 0.447715 7.44772 0 8 0C8.55229 0 9 0.447715 9 1V3.1C9.6264 3.22915 10.222 3.47804 10.754 3.833L12.244 2.343C12.6364 1.96403 13.2601 1.96945 13.6458 2.35518C14.0316 2.74092 14.037 3.36462 13.658 3.757L12.168 5.247C12.5225 5.7788 12.7711 6.37401 12.9 7ZM8 5C6.34315 5 5 6.34315 5 8C5 9.65685 6.34315 11 8 11C9.65685 11 11 9.65685 11 8C11 6.34315 9.65685 5 8 5Z"
    />
  </svg>
);

export const FaqIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path d="M2 4H0V18C0 19.1 0.9 20 2 20H16V18H2V4ZM18 0H6C4.9 0 4 0.9 4 2V14C4 15.1 4.9 16 6 16H18C19.1 16 20 15.1 20 14V2C20 0.9 19.1 0 18 0ZM18 14H6V2H18V14ZM11.51 8.16C11.92 7.43 12.69 7 13.14 6.36C13.62 5.68 13.35 4.42 12 4.42C11.12 4.42 10.68 5.09 10.5 5.65L9.13 5.08C9.51 3.96 10.52 3 11.99 3C13.22 3 14.07 3.56 14.5 4.26C14.87 4.86 15.08 5.99 14.51 6.83C13.88 7.76 13.28 8.04 12.95 8.64C12.82 8.88 12.77 9.04 12.77 9.82H11.25C11.26 9.41 11.19 8.74 11.51 8.16ZM10.95 11.95C10.95 11.36 11.42 10.91 12 10.91C12.59 10.91 13.04 11.36 13.04 11.95C13.04 12.53 12.6 13 12 13C11.42 13 10.95 12.53 10.95 11.95Z" />
  </svg>
);

export const DashboardIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="3 3 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M5 5H9V9H5V5ZM3 5C3 3.89543 3.89543 3 5 3H9C10.1046 3 11 3.89543 11 5V9C11 10.1046 10.1046 11 9 11H5C3.89543 11 3 10.1046 3 9V5ZM15 5H19V9H15V5ZM13 5C13 3.89543 13.8954 3 15 3H19C20.1046 3 21 3.89543 21 5V9C21 10.1046 20.1046 11 19 11H15C13.8954 11 13 10.1046 13 9V5ZM9 15H5V19H9V15ZM5 13C3.89543 13 3 13.8954 3 15V19C3 20.1046 3.89543 21 5 21H9C10.1046 21 11 20.1046 11 19V15C11 13.8954 10.1046 13 9 13H5ZM15 15H19V19H15V15ZM13 15C13 13.8954 13.8954 13 15 13H19C20.1046 13 21 13.8954 21 15V19C21 20.1046 20.1046 21 19 21H15C13.8954 21 13 20.1046 13 19V15Z"
    />
  </svg>
);

export const HomeIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path d="M10 2.69L15 7.19V15H13V9H7V15H5V7.19L10 2.69ZM10 0L0 9H3V17H9V11H11V17H17V9H20L10 0Z" />
  </svg>
);

export const SupportIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="3 3 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M19 12C19 15.866 15.866 19 12 19C8.13401 19 5 15.866 5 12C5 8.13401 8.13401 5 12 5C15.866 5 19 8.13401 19 12ZM21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12ZM10.751 7.17226C11.1116 7.03691 11.4969 6.98025 11.8811 7.00608C12.5103 6.98446 13.1288 7.17265 13.6393 7.54105C14.1498 7.90945 14.5233 8.43714 14.7011 9.04108C14.8463 9.6161 14.7934 10.2233 14.551 10.7645C14.3086 11.3058 13.8908 11.7495 13.3651 12.0241C13.2011 12.0973 13.0589 12.2116 12.9522 12.356C12.8455 12.5003 12.7779 12.6699 12.7561 12.8481V13.2181C12.7561 13.4501 12.6639 13.6727 12.4998 13.8368C12.3357 14.0009 12.1131 14.0931 11.8811 14.0931C11.649 14.0931 11.4265 14.0009 11.2624 13.8368C11.0983 13.6727 11.0061 13.4501 11.0061 13.2181V12.8811C11.0177 12.3909 11.1607 11.9129 11.4201 11.4968C11.6796 11.0808 12.046 10.7421 12.4811 10.5161C12.6744 10.4356 12.8334 10.2898 12.9303 10.1042C13.0271 9.91848 13.0557 9.70469 13.0111 9.50008C12.9318 9.26838 12.7778 9.06959 12.5733 8.93492C12.3687 8.80026 12.1252 8.73735 11.8811 8.75608C11.3561 8.75608 10.7561 8.88108 10.7561 9.88108C10.7561 10.1131 10.6639 10.3357 10.4998 10.4998C10.3357 10.6639 10.1131 10.7561 9.88108 10.7561C9.64901 10.7561 9.42646 10.6639 9.26236 10.4998C9.09827 10.3357 9.00608 10.1131 9.00608 9.88108C8.98025 9.49686 9.03691 9.11155 9.17226 8.75103C9.30761 8.39051 9.51851 8.06311 9.79081 7.79081C10.0631 7.51851 10.3905 7.30761 10.751 7.17226ZM11.1866 14.8417C11.3922 14.7044 11.6339 14.6311 11.8811 14.6311C12.2126 14.6311 12.5305 14.7628 12.765 14.9972C12.9994 15.2316 13.1311 15.5496 13.1311 15.8811C13.1311 16.1283 13.0578 16.37 12.9204 16.5755C12.7831 16.7811 12.5878 16.9413 12.3594 17.0359C12.131 17.1305 11.8797 17.1553 11.6372 17.1071C11.3947 17.0588 11.172 16.9398 10.9972 16.765C10.8224 16.5901 10.7033 16.3674 10.6551 16.1249C10.6069 15.8825 10.6316 15.6311 10.7262 15.4027C10.8208 15.1743 10.9811 14.9791 11.1866 14.8417Z"
    />
  </svg>
);

/** Icon to indicate signing out, that inherits the text color of its container */
export const SignOutIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path d="M12.2649 2.33395C11.8376 2.03969 11.2504 2.14437 10.958 2.56833C10.6632 2.99573 10.7678 3.58336 11.1919 3.87589L11.1928 3.8765C12.7786 4.98288 13.7194 6.79017 13.7194 8.70868C13.7194 11.9728 11.0641 14.6281 7.8 14.6281C4.53668 14.6281 1.88062 11.9914 1.88062 8.7265C1.88062 6.80799 2.82137 5.00069 4.40717 3.89432L4.40806 3.8937C4.83222 3.60118 4.93679 3.01355 4.64204 2.58615C4.34954 2.16203 3.762 2.05743 3.33461 2.35208C1.25087 3.79338 0 6.19052 0 8.7265C0 13.0348 3.49175 16.5265 7.8 16.5265C12.1083 16.5265 15.6 13.0348 15.6 8.7265C15.6 6.19091 14.3494 3.79337 12.2649 2.33395ZM7.80005 8.22361C8.3132 8.22361 8.74037 7.79645 8.74037 7.2833V0.940312C8.74037 0.427161 8.3132 0 7.80005 0C7.2869 0 6.85974 0.427161 6.85974 0.940312V7.26548C6.85974 7.79847 7.28891 8.22361 7.80005 8.22361Z" />
  </svg>
);

export const ContactIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => (
  <svg
    width={20}
    height={20}
    viewBox="0 0 20 20"
    role="img"
    aria-hidden={alt === ""}
    aria-label={alt}
    xmlns="http://www.w3.org/2000/svg"
    {...props}
    className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
  >
    <title>{alt}</title>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2.423 0H13.577C14.9145 0.00165294 15.9983 1.0855 16 2.423V8.577C15.9983 9.9145 14.9145 10.9983 13.577 11H13V14C12.9999 14.4227 12.7341 14.7996 12.3361 14.9417C11.938 15.0837 11.4936 14.9601 11.226 14.633L8.26 11H2.423C1.0855 10.9983 0.00165294 9.9145 0 8.577V2.423C0.00165294 1.0855 1.0855 0.00165294 2.423 0ZM13.8761 8.87611C13.9554 8.79678 14 8.68919 14 8.577V2.423C14 2.18938 13.8106 2 13.577 2H2.423C2.18938 2 2 2.18938 2 2.423V8.577C2 8.68919 2.04457 8.79678 2.12389 8.87611C2.20322 8.95543 2.31081 9 2.423 9H8.734C9.03434 8.99975 9.31889 9.13449 9.509 9.367L11 11.194V10C11 9.44771 11.4477 9 12 9H13.577C13.6892 9 13.7968 8.95543 13.8761 8.87611ZM11.5 4H4.5C4.22386 4 4 4.22386 4 4.5C4 4.77614 4.22386 5 4.5 5H11.5C11.7761 5 12 4.77614 12 4.5C12 4.22386 11.7761 4 11.5 4ZM4.5 6H11.5C11.7761 6 12 6.22386 12 6.5C12 6.77614 11.7761 7 11.5 7H4.5C4.22386 7 4 6.77614 4 6.5C4 6.22386 4.22386 6 4.5 6Z"
    />
  </svg>
);

/** Icon of a crossed out eye that inherits the text color of its container */
export const HideIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 18"
      width={20}
      height={18}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="m 3.28,0.21975 c -0.293,-0.293 -0.768,-0.293 -1.061,0 -0.293,0.293 -0.293,0.768 0,1.061 l 2.308,2.308 C 2.533,4.81775 0.911,6.68975 0,8.99375 v 1.012 c 1.656,4.189 5.634,6.994 10,6.994 2.182,0 4.259,-0.711 6.005,-1.934 l 2.715,2.715 c 0.146,0.146 0.338,0.22 0.53,0.22 0.192,0 0.384,-0.073 0.53,-0.22 0.293,-0.293 0.293,-0.768 0,-1.061 z m 5.547,7.668 2.785,2.785 c -0.364,0.499 -0.949,0.827 -1.612,0.827 -1.103,0 -2,-0.897 -2,-2 0,-0.664 0.328,-1.248 0.827,-1.612 z m 1.173,7.612 c -3.629,0 -7.011,-2.316 -8.5,-5.791 v -0.419 c 0.854,-1.995 2.341,-3.589 4.133,-4.597 l 2.132,2.132 c -0.769,0.641 -1.265,1.597 -1.265,2.675 0,1.93 1.57,3.5 3.5,3.5 1.078,0 2.034,-0.496 2.674,-1.265 l 2.25,2.25 c -1.458,0.962 -3.16,1.515 -4.924,1.515 z" />
      <path d="m 10,1.99975 c -0.842,0 -1.669,0.107 -2.468,0.305 l 1.288,1.288 c 0.389,-0.054 0.782,-0.093 1.18,-0.093 3.629,0 7.011,2.316 8.5,5.791 v 0.419 c -0.348,0.812 -0.807,1.553 -1.341,2.223 l 1.074,1.074 c 0.726,-0.887 1.329,-1.894 1.767,-3.001 v -1.012 c -1.656,-4.189 -5.634,-6.994 -10,-6.994 z" />
    </svg>
  );
};

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

export const StarIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width={24}
      height={24}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M19.8451 10.064C19.7827 9.87742 19.6714 9.71099 19.5228 9.58207C19.3741 9.45314 19.1936 9.36644 19.0001 9.331L14.9111 8.6L12.9851 4.735C12.8939 4.55195 12.7534 4.39796 12.5795 4.29033C12.4056 4.18269 12.2051 4.12567 12.0006 4.12567C11.7961 4.12567 11.5956 4.18269 11.4217 4.29033C11.2478 4.39796 11.1074 4.55195 11.0161 4.735L9.08912 8.6L5.00812 9.329C4.81293 9.3631 4.63057 9.44929 4.48031 9.57846C4.33006 9.70763 4.21749 9.875 4.15449 10.0629C4.09149 10.2507 4.08041 10.4521 4.12241 10.6458C4.16442 10.8394 4.25795 11.0181 4.39312 11.163L7.32012 14.31L6.71112 18.67C6.68304 18.8703 6.71074 19.0745 6.79117 19.2601C6.8716 19.4457 7.00165 19.6055 7.16702 19.722C7.33239 19.8385 7.52668 19.9071 7.72853 19.9204C7.93037 19.9336 8.13196 19.8909 8.31112 19.797L12.0001 17.873L15.6901 19.8C15.8693 19.8939 16.0709 19.9366 16.2727 19.9234C16.4746 19.9101 16.6688 19.8415 16.8342 19.725C16.9996 19.6085 17.1296 19.4487 17.2101 19.2631C17.2905 19.0775 17.3182 18.8733 17.2901 18.673L16.6801 14.31L19.6061 11.164C19.7413 11.0192 19.8349 10.8405 19.877 10.6469C19.9191 10.4533 19.908 10.2519 19.8451 10.064V10.064Z" />
    </svg>
  );
};

export const ChevronLeftIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width={24}
      height={24}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M16.6201 2.99C16.1301 2.5 15.3401 2.5 14.8501 2.99L6.54006 11.3C6.15006 11.69 6.15006 12.32 6.54006 12.71L14.8501 21.02C15.3401 21.51 16.1301 21.51 16.6201 21.02C17.1101 20.53 17.1101 19.74 16.6201 19.25L9.38006 12L16.6301 4.75C17.1101 4.27 17.1101 3.47 16.6201 2.99Z" />
    </svg>
  );
};

export const ChevronRightIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 22 22"
      width={24}
      height={24}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M7.37994 2.99C7.86994 2.5 8.65994 2.5 9.14994 2.99L17.4599 11.3C17.8499 11.69 17.8499 12.32 17.4599 12.71L9.14994 21.02C8.65994 21.51 7.86994 21.51 7.37994 21.02C6.88994 20.53 6.88994 19.74 7.37994 19.25L14.6199 12L7.36994 4.75C6.88994 4.27 6.88994 3.47 7.37994 2.99Z" />
    </svg>
  );
};

export const QuotationIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 4 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10.4 0.399995C3.7 7.6 0.8 12.8 0.8 18.2C0.8 24.5 4.1 29.1 9.2 29.1C13.5 29.1 17 25.5 17 21.3C17 17 13.6 13.4 9.4 13.4C10.2 10.2 12.2 7 15.2 4L10.4 0.399995ZM34.4 0.399995C27.7 7.6 24.8 12.8 24.8 18.2C24.8 24.5 28.1 29.1 33.2 29.1C37.5 29.1 41 25.5 41 21.3C41 17 37.6 13.4 33.4 13.4C34.2 10.2 36.2 7 39.2 4L34.4 0.399995Z" />
    </svg>
  );
};

export const ForwardIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -5 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M16.86 3.6C15.01 1.99 12.61 1 9.96 1C5.31 1 1.38 4.03 0 8.22L2.36 9C3.41 5.81 6.41 3.5 9.96 3.5C11.91 3.5 13.69 4.22 15.08 5.38L11.46 9H20.46V0L16.86 3.6Z" />
    </svg>
  );
};

export const BlockIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM2 10C2 5.58 5.58 2 10 2C11.85 2 13.55 2.63 14.9 3.69L3.69 14.9C2.63 13.55 2 11.85 2 10ZM10 18C8.15 18 6.45 17.37 5.1 16.31L16.31 5.1C17.37 6.45 18 8.15 18 10C18 14.42 14.42 18 10 18Z" />
    </svg>
  );
};

export const ForwardedTextIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.81725 0H10.1827C11.1859 0.0012397 11.9988 0.814124 12 1.81725V6.43275C11.9988 7.43587 11.1859 8.24876 10.1827 8.25H9.75V10.5C9.74994 10.817 9.5506 11.0997 9.25205 11.2062C8.9535 11.3128 8.62021 11.2201 8.4195 10.9747L6.195 8.25H1.81725C0.814125 8.24876 0.0012397 7.43587 0 6.43275V1.81725C0.0012397 0.814124 0.814125 0.0012397 1.81725 0ZM10.4071 6.65708C10.4666 6.59758 10.5 6.51689 10.5 6.43275V1.81725C10.5 1.64204 10.358 1.5 10.1827 1.5H1.81725C1.64204 1.5 1.5 1.64204 1.5 1.81725V6.43275C1.5 6.51689 1.53342 6.59758 1.59292 6.65708C1.65242 6.71658 1.73311 6.75 1.81725 6.75H6.5505C6.77575 6.74981 6.98916 6.85087 7.13175 7.02525L8.25 8.3955V7.5C8.25 7.08579 8.58579 6.75 9 6.75H10.1827C10.2669 6.75 10.3476 6.71658 10.4071 6.65708ZM8.625 3H3.375C3.16789 3 3 3.16789 3 3.375C3 3.58211 3.16789 3.75 3.375 3.75H8.625C8.83211 3.75 9 3.58211 9 3.375C9 3.16789 8.83211 3 8.625 3ZM3.375 4.5H8.625C8.83211 4.5 9 4.66789 9 4.875C9 5.08211 8.83211 5.25 8.625 5.25H3.375C3.16789 5.25 3 5.08211 3 4.875C3 4.66789 3.16789 4.5 3.375 4.5Z"
      />
    </svg>
  );
};

export const ForwardedCallIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 9 12"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M7.75 0H2.75C2.41848 0 2.10054 0.158035 1.86612 0.43934C1.6317 0.720644 1.5 1.10218 1.5 1.5V3C1.5 3.19891 1.56585 3.38968 1.68306 3.53033C1.80027 3.67098 1.95924 3.75 2.125 3.75C2.29076 3.75 2.44973 3.67098 2.56694 3.53033C2.68415 3.38968 2.75 3.19891 2.75 3V1.875C2.75 1.77554 2.78292 1.68016 2.84153 1.60984C2.90013 1.53951 2.97962 1.5 3.0625 1.5H7.4375C7.52038 1.5 7.59987 1.53951 7.65847 1.60984C7.71708 1.68016 7.75 1.77554 7.75 1.875V9.375C7.75 9.47446 7.71708 9.56984 7.65847 9.64017C7.59987 9.71049 7.52038 9.75 7.4375 9.75H3.0625C2.97962 9.75 2.90013 9.71049 2.84153 9.64017C2.78292 9.56984 2.75 9.47446 2.75 9.375V8.25C2.75 8.05109 2.68415 7.86032 2.56694 7.71967C2.44973 7.57902 2.29076 7.5 2.125 7.5C1.95924 7.5 1.80027 7.57902 1.68306 7.71967C1.56585 7.86032 1.5 8.05109 1.5 8.25V10.5C1.5 10.8978 1.6317 11.2794 1.86612 11.5607C2.10054 11.842 2.41848 12 2.75 12H7.75C8.08152 12 8.39946 11.842 8.63388 11.5607C8.8683 11.2794 9 10.8978 9 10.5V1.5C9 1.10218 8.8683 0.720644 8.63388 0.43934C8.39946 0.158035 8.08152 0 7.75 0ZM5.875 11.25H4.625V10.5H5.875V11.25Z" />
      <path d="M3.8595 7.60944C3.82368 7.64403 3.79512 7.68541 3.77546 7.73116C3.75581 7.77691 3.74546 7.82612 3.74503 7.87591C3.7446 7.9257 3.75409 7.97508 3.77294 8.02117C3.7918 8.06725 3.81964 8.10912 3.85485 8.14433C3.89006 8.17954 3.93193 8.20739 3.97802 8.22624C4.0241 8.2451 4.07348 8.25459 4.12328 8.25415C4.17307 8.25372 4.22228 8.24338 4.26803 8.22372C4.31378 8.20407 4.35516 8.1755 4.38975 8.13968L6.63975 5.88969C6.67467 5.85485 6.70238 5.81347 6.72128 5.76791C6.74019 5.72235 6.74992 5.67351 6.74992 5.62419C6.74992 5.57486 6.74019 5.52602 6.72128 5.48046C6.70238 5.4349 6.67467 5.39352 6.63975 5.35869L4.38975 3.10868C4.31902 3.04038 4.2243 3.00258 4.12597 3.00343C4.02765 3.00429 3.9336 3.04372 3.86407 3.11325C3.79454 3.18278 3.7551 3.27684 3.75425 3.37516C3.75339 3.47348 3.79119 3.56821 3.8595 3.63894L5.46975 5.24993H0.375C0.275544 5.24993 0.180161 5.28944 0.109835 5.35977C0.0395088 5.4301 0 5.52548 0 5.62493C0 5.72439 0.0395088 5.81977 0.109835 5.8901C0.180161 5.96043 0.275544 5.99993 0.375 5.99993H5.46975L3.8595 7.60944Z" />
    </svg>
  );
};

// Keywords: mail, mask, alias, letter, email
export const MaskIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 17"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M20 2C20 0.9 19.1 0 18 0H2C0.9 0 0 0.9 0 2V14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2ZM18 2L10 7L2 2H18ZM18 14H2V4L10 9L18 4V14Z" />
    </svg>
  );
};

// Keywords: phonenumber, cell, call
export const PhoneIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 15 25"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <title>{alt}</title>
      <path d="M10.5 0H2.5C1.12 0 0 1.12 0 2.5V19.5C0 20.88 1.12 22 2.5 22H10.5C11.88 22 13 20.88 13 19.5V2.5C13 1.12 11.88 0 10.5 0ZM6.5 21C5.67 21 5 20.33 5 19.5C5 18.67 5.67 18 6.5 18C7.33 18 8 18.67 8 19.5C8 20.33 7.33 21 6.5 21ZM11 17H2V3H11V17Z" />
    </svg>
  );
};

export const RefreshIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <path d="M13.65 3.34999C12.02 1.71999 9.71002 0.779992 7.17002 1.03999C3.50002 1.40999 0.480021 4.38999 0.0700213 8.05999C-0.479979 12.91 3.27002 17 8.00002 17C11.19 17 13.93 15.13 15.21 12.44C15.53 11.77 15.05 11 14.31 11C13.94 11 13.59 11.2 13.43 11.53C12.3 13.96 9.59002 15.5 6.63002 14.84C4.41002 14.35 2.62002 12.54 2.15002 10.32C1.31002 6.43999 4.26002 2.99999 8.00002 2.99999C9.66002 2.99999 11.14 3.68999 12.22 4.77999L10.71 6.28999C10.08 6.91999 10.52 7.99999 11.41 7.99999H15C15.55 7.99999 16 7.54999 16 6.99999V3.40999C16 2.51999 14.92 2.06999 14.29 2.69999L13.65 3.34999Z" />
    </svg>
  );
};

// Keywords: vpn, mozilla vpn, connection, server
export const VpnIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 23 25"
      width={20}
      height={20}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <path d="M10.7881 1.04257C9.66489 1.25499 8.68583 1.8973 8.0625 2.83073C7.67619 3.40924 7.46233 4.00813 7.38472 4.72878C7.31142 5.40959 7.44549 6.20797 7.73936 6.841L7.85562 7.09149L6.9697 7.97738L6.08381 8.86331L5.82458 8.74581C4.25533 8.03427 2.42251 8.36451 1.20972 9.57729C0.669472 10.1175 0.297716 10.7595 0.101127 11.4914C0.0114476 11.8254 0 11.9407 0 12.5084C0 13.0801 0.0110984 13.1903 0.103843 13.5367C0.48794 14.9721 1.56056 16.0729 2.97428 16.4826C3.47014 16.6263 4.04524 16.6783 4.52351 16.6227C6.07546 16.4423 7.35445 15.4895 7.93552 14.0809L8.07992 13.7308L11.4986 13.7209C14.7287 13.7115 14.9185 13.7147 14.9408 13.7791C14.9539 13.8165 15.0259 13.9928 15.101 14.1708L15.2376 14.4944L14.3631 15.3689L13.4886 16.2434L13.1042 16.0858C11.7166 15.5168 10.1864 15.7157 8.98471 16.6211C7.86913 17.4617 7.23652 18.9115 7.38472 20.288C7.57506 22.0558 8.76507 23.4459 10.4831 23.9073C10.817 23.9969 10.9323 24.0084 11.5 24.0084C12.0717 24.0084 12.1819 23.9973 12.5283 23.9045C14.2328 23.4484 15.4254 22.0512 15.6153 20.288C15.6886 19.6072 15.5545 18.8088 15.2606 18.1758L15.1444 17.9253L16.0307 17.039L16.9169 16.1528L17.1674 16.269C17.8004 16.5629 18.5988 16.697 19.2796 16.6237C21.0474 16.4333 22.4375 15.2433 22.8989 13.5253C22.9886 13.1914 23 13.0761 23 12.5084C23 11.939 22.9886 11.8251 22.8971 11.48C22.5216 10.0647 21.4234 8.93925 20.0212 8.53288C18.0017 7.9477 15.8193 9.02614 15.0389 10.995L14.9235 11.286L11.5032 11.2959C8.27146 11.3053 8.08155 11.3021 8.05916 11.2377C8.04612 11.2003 7.97406 11.024 7.89897 10.846L7.76245 10.5223L8.63693 9.64784L9.51142 8.77336L9.89578 8.93099C11.9353 9.76732 14.2605 8.89796 15.205 6.94601C15.9894 5.32464 15.6837 3.47067 14.4242 2.21116C13.8881 1.67506 13.2362 1.29966 12.5169 1.11281C12.0355 0.987779 11.2472 0.955726 10.7881 1.04257ZM11.9449 3.40978C12.2732 3.49531 12.5171 3.64103 12.7625 3.89827C13.6754 4.85529 13.2972 6.37937 12.0412 6.80522C11.8315 6.87632 11.7305 6.88722 11.4164 6.87251C11.0857 6.85703 11.0069 6.8384 10.7443 6.71364C9.64785 6.19299 9.39403 4.78257 10.2375 3.89827C10.6872 3.42682 11.3177 3.24641 11.9449 3.40978ZM4.39786 10.7647C4.96718 10.8571 5.45628 11.2297 5.71259 11.7665C5.84969 12.0535 5.85381 12.0752 5.85381 12.5084C5.85381 12.9437 5.85024 12.9621 5.70887 13.2582C5.16924 14.3884 3.69347 14.6288 2.82969 13.7273C2.30338 13.178 2.19394 12.3256 2.56275 11.6479C2.78406 11.2413 3.34701 10.8408 3.80546 10.7637C4.07054 10.7191 4.11726 10.7192 4.39786 10.7647ZM19.1597 10.7612C19.6556 10.8424 20.2072 11.2253 20.4372 11.6479C20.9176 12.5305 20.5698 13.6528 19.6804 14.0907C18.7845 14.5317 17.7225 14.1617 17.2911 13.2582C17.1497 12.9619 17.1462 12.944 17.1462 12.5063C17.1462 12.0646 17.1484 12.0535 17.2951 11.7568C17.597 11.1459 18.1728 10.7659 18.8536 10.7281C18.8963 10.7257 19.034 10.7406 19.1597 10.7612ZM12.2581 18.3067C13.3819 18.8622 13.6158 20.3194 12.7189 21.1787C11.8633 21.9985 10.4543 21.7502 9.92993 20.6872C9.43307 19.6798 9.92291 18.5511 11.0149 18.1873C11.1165 18.1534 11.3073 18.14 11.5669 18.1483C11.9343 18.1602 11.9853 18.1719 12.2581 18.3067Z" />
    </svg>
  );
};

export const MozillaVpnWordmark = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 38"
      width={100}
      height={38}
      {...props}
    >
      <path
        d="M37.9299 11.2269H39.7548V5.87685L42.3989 10.7269L45.0306 5.87685V11.2269H46.8679V2.63936H45.0306L42.3989 7.48935L39.7548 2.63936H37.9299V11.2269Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M51.724 11.3769C53.6233 11.3769 55.2123 9.82685 55.2123 7.98935C55.2123 6.15185 53.6233 4.61435 51.724 4.61435C49.8123 4.61435 48.2109 6.15185 48.2109 7.98935C48.2109 9.82685 49.8123 11.3769 51.724 11.3769ZM51.724 9.83935C50.7557 9.83935 49.9488 8.98935 49.9488 7.98935C49.9488 6.98935 50.7557 6.15185 51.724 6.15185C52.6798 6.15185 53.4867 6.98935 53.4867 7.98935C53.4867 8.98935 52.6798 9.83935 51.724 9.83935Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M56.1531 11.2269H61.7641V9.67685H58.5117L61.7393 6.05185V4.76435H56.24V6.31435H59.3807L56.1531 9.93935V11.2269Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M63.9518 3.87686C64.4856 3.87686 64.92 3.42686 64.92 2.87685C64.92 2.36436 64.4856 1.90186 63.9518 1.90186C63.3931 1.90186 62.9587 2.36436 62.9587 2.87685C62.9587 3.42686 63.3931 3.87686 63.9518 3.87686ZM63.0331 11.2269H64.8456V4.76435H63.0331V11.2269Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M66.4278 11.2269H68.2402V2.48936H66.4278V11.2269Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M69.8222 11.2269H71.6346V2.48936H69.8222V11.2269Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M76.0842 4.61435C75.1904 4.61435 74.309 4.86435 73.4028 5.32685L74.0111 6.53935C74.5201 6.27685 75.0787 6.07685 75.6746 6.07685C76.7297 6.07685 77.1518 6.67685 77.1518 7.36435V7.48935C76.6056 7.27685 76.0346 7.16435 75.5132 7.16435C74.0235 7.16435 72.8442 8.03935 72.8442 9.31435C72.8442 10.5519 73.8994 11.3769 75.2649 11.3769C75.9601 11.3769 76.6925 11.1019 77.1518 10.5769V11.2269H78.9021V7.36435C78.9021 5.67685 77.7601 4.61435 76.0842 4.61435ZM75.6746 10.1144C75.0539 10.1144 74.5946 9.78935 74.5946 9.26435C74.5946 8.73935 75.1159 8.35185 75.7739 8.35185C76.2704 8.35185 76.7421 8.43935 77.1518 8.58935V9.18935C77.0277 9.78935 76.3697 10.1144 75.6746 10.1144Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M53.6079 15.1475L47.9017 29.2641L42.1955 15.1475H37.3872L45.4976 35.185H50.2769L58.3872 15.1475H53.6079Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M60.7327 35.185H64.9907V28.6808H69.6831C73.9989 28.6808 77.1851 25.8808 77.1851 21.9141C77.1851 17.9475 73.9989 15.1475 69.6831 15.1475H60.7327V35.185ZM64.9907 24.7433V19.085H69.2196C71.3341 19.085 72.7824 20.1933 72.7824 21.9141C72.7824 23.635 71.3341 24.7433 69.2196 24.7433H64.9907Z"
        className={styles["colorify-fill"]}
      />
      <path
        d="M80.0283 35.185H84.2862V22.235L93.8738 35.185H98.1607V15.1475H93.8738V28.0975L84.2862 15.1475H80.0283V35.185Z"
        className={styles["colorify-fill"]}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.3906 5.60189C17.0194 5.60189 15.9079 6.72118 15.9079 8.10189C15.9079 9.4826 17.0194 10.6019 18.3906 10.6019C19.7618 10.6019 20.8734 9.4826 20.8734 8.10189C20.8734 6.72118 19.7618 5.60189 18.3906 5.60189ZM12.5975 8.10189C12.5975 4.88023 15.1912 2.26855 18.3906 2.26855C21.5901 2.26855 24.1837 4.88023 24.1837 8.10189C24.1837 11.3235 21.5901 13.9352 18.3906 13.9352C17.3929 13.9352 16.4542 13.6813 15.6346 13.2341L13.1426 15.7434C13.3307 16.0929 13.4843 16.4639 13.599 16.8519H23.1822C23.8944 14.4423 26.1112 12.6852 28.7354 12.6852C31.9349 12.6852 34.5285 15.2969 34.5285 18.5186C34.5285 21.7402 31.9349 24.3519 28.7354 24.3519C27.7378 24.3519 26.799 24.0979 25.9794 23.6507L23.4874 26.1601C23.9315 26.9853 24.1837 27.9306 24.1837 28.9352C24.1837 32.1569 21.5901 34.7686 18.3906 34.7686C15.1912 34.7686 12.5975 32.1569 12.5975 28.9352C12.5975 25.7136 15.1912 23.1019 18.3906 23.1019C19.3883 23.1019 20.327 23.3558 21.1466 23.803L23.6386 21.2937C23.4506 20.9442 23.2969 20.5732 23.1822 20.1852H13.599C12.8868 22.5948 10.6701 24.3519 8.04579 24.3519C4.84635 24.3519 2.25269 21.7402 2.25269 18.5186C2.25269 15.2969 4.84635 12.6852 8.04579 12.6852C9.04345 12.6852 9.98222 12.9392 10.8018 13.3864L13.2938 10.877C12.8497 10.0518 12.5975 9.10648 12.5975 8.10189ZM15.9079 28.9352C15.9079 27.5545 17.0194 26.4352 18.3906 26.4352C19.7618 26.4352 20.8734 27.5545 20.8734 28.9352C20.8734 30.3159 19.7618 31.4352 18.3906 31.4352C17.0194 31.4352 15.9079 30.3159 15.9079 28.9352ZM8.04579 16.0186C6.6746 16.0186 5.56303 17.1378 5.56303 18.5186C5.56303 19.8993 6.6746 21.0186 8.04579 21.0186C9.41698 21.0186 10.5285 19.8993 10.5285 18.5186C10.5285 17.1378 9.41698 16.0186 8.04579 16.0186ZM26.2527 18.5186C26.2527 17.1378 27.3643 16.0186 28.7354 16.0186C30.1066 16.0186 31.2182 17.1378 31.2182 18.5186C31.2182 19.8993 30.1066 21.0186 28.7354 21.0186C27.3643 21.0186 26.2527 19.8993 26.2527 18.5186Z"
        className={styles["colorify-fill"]}
      />
    </svg>
  );
};

// Keywords: edit, pen, change, customize, subdomain
export const PencilIcon = ({
  alt,
  ...props
}: SVGProps<SVGSVGElement> & { alt: string }) => {
  return (
    <svg
      role="img"
      aria-label={alt}
      aria-hidden={alt === ""}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 12 12"
      width={15}
      height={15}
      {...props}
      className={`${props.className ?? ""} ${styles["colorify-fill"]}`}
    >
      <path d="M10.7621 1.77078L10.2311 1.2112C9.94918 0.915782 9.56797 0.75 9.17065 0.75C8.77333 0.75 8.39212 0.915782 8.11015 1.2112L7.8259 1.51117C7.7556 1.58538 7.7161 1.68602 7.7161 1.79096C7.7161 1.8959 7.7556 1.99654 7.8259 2.07075L9.94765 4.30988C10.018 4.38407 10.1133 4.42575 10.2128 4.42575C10.3122 4.42575 10.4076 4.38407 10.4779 4.30988L10.7621 4.00991C11.0421 3.71221 11.1992 3.30978 11.1992 2.89034C11.1992 2.47091 11.0421 2.06848 10.7621 1.77078V1.77078ZM7.29565 2.63034C7.22533 2.55615 7.12996 2.51447 7.03052 2.51447C6.93109 2.51447 6.83572 2.55615 6.7654 2.63034L2.43115 7.20436C2.28122 7.36443 2.16562 7.55661 2.09215 7.76791L0.775149 11.2425C0.753326 11.3022 0.745535 11.3666 0.752444 11.4301C0.759353 11.4937 0.780755 11.5545 0.814818 11.6074C0.84888 11.6603 0.894588 11.7038 0.948026 11.7339C1.00146 11.7641 1.06104 11.7802 1.12165 11.7808C1.17 11.7807 1.21788 11.7707 1.26265 11.7515L4.54915 10.3648C4.75078 10.2876 4.93404 10.165 5.08615 10.0054L9.4204 5.43222C9.4907 5.358 9.53019 5.25736 9.53019 5.15242C9.53019 5.04749 9.4907 4.94685 9.4204 4.87263L7.29565 2.63034ZM3.8674 9.80204L1.95565 10.6094C1.94202 10.6151 1.92709 10.6165 1.91271 10.6134C1.89833 10.6103 1.88513 10.6028 1.87474 10.5918C1.86436 10.5809 1.85726 10.567 1.85431 10.5518C1.85136 10.5366 1.85269 10.5208 1.85815 10.5065L2.62165 8.48104C2.6266 8.46955 2.63409 8.45947 2.64348 8.45166C2.65288 8.44384 2.66391 8.43851 2.67565 8.43611C2.6874 8.4337 2.69952 8.4343 2.711 8.43785C2.72248 8.4414 2.73299 8.44779 2.74165 8.4565L3.89665 9.67144C3.90559 9.68098 3.91208 9.69277 3.91552 9.70568C3.91895 9.7186 3.91922 9.73223 3.9163 9.74529C3.91337 9.75835 3.90735 9.7704 3.8988 9.78033C3.89024 9.79026 3.87944 9.79773 3.8674 9.80204V9.80204Z" />
    </svg>
  );
};
