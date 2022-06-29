// Note: ideally, the Nebula icons are made available in a repository somewhere,
//       then added to react-icons: https://react-icons.github.io/react-icons/.
//       These manually-created components are a workaround until that is done.

import { useLocalization } from "@fluent/react";
import { SVGProps } from "react";
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
      <path d="M10 0C4.48 0 0 4.48 0 10C0 15.52 4.48 20 10 20C15.52 20 20 15.52 20 10C20 4.48 15.52 0 10 0ZM11 15H9V13H11V15ZM11 11H9V5H11V11Z" />
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
  const { l10n } = useLocalization();

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
