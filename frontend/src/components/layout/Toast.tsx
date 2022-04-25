import { clearCookie, getCookie } from "../../functions/cookies";
import { toast } from "react-toastify";
import { ReactLocalization } from "@fluent/react";
import { UserData } from "../../hooks/api/user";

export function makeToast(l10n: ReactLocalization, usersData?: UserData) {
  const checkUserSignOut = getCookie("user-sign-out");

  const checkUserSignIn = getCookie("user-sign-in");

  if (checkUserSignOut) {
    clearCookie("user-sign-out");
    return toast.success(l10n.getString("success-signed-out-message"));
  }

  if (checkUserSignIn && typeof usersData !== "undefined") {
    clearCookie("user-sign-in");
    return toast.success(
      l10n.getString("success-signed-in-message", { username: usersData.email })
    );
  }
}
