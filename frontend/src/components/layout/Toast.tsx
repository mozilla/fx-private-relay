import { clearCookie, getCookie } from "../../functions/cookies";
import { toast } from "react-toastify";

export function makeToast() {
  const checkUserSignOut = getCookie("user-sign-out");

  const checkUserSignIn = getCookie("user-sign-in");

  if (checkUserSignOut) {
    clearCookie("user-sign-out");
    return toast.success("Successfully toasted!");
  }

  if (checkUserSignIn) {
    clearCookie("user-sign-in");
    return toast.success("Successfully signed in");
  }
}
