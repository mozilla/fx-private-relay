import { clearCookie, getCookie } from "../../functions/cookies";
import { toast } from "react-toastify";
import { ReactLocalization } from "@fluent/react";

export function makeToast(l10n: ReactLocalization) {
  const checkUserSignOut = getCookie("user-sign-out");

  const checkUserSignIn = getCookie("user-sign-in");

  if (checkUserSignOut) {
    clearCookie("user-sign-out");
    return toast.success(l10n.getString("success-signed-out-message"));
  }

  if (checkUserSignIn) {
    clearCookie("user-sign-in");
    return toast.success(l10n.getString("success-signed-in-message"));
  }
}
