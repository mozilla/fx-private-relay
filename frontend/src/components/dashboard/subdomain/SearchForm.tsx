import { useLocalization } from "@fluent/react";
import { FormEventHandler, ChangeEventHandler, useState } from "react";
import { VisuallyHidden } from "react-aria";
import { toast } from "react-toastify";
import { authenticatedFetch } from "../../../hooks/api/api";
import { Button } from "../../Button";

export type Props = {
  onType: (_partial: string) => void;
  onPick: (_subdomain: string) => void;
};

/**
 * Form with which the user can check whether a given subdomain is still available for them to claim.
 */
export const SubdomainSearchForm = (props: Props) => {
  const { l10n } = useLocalization();
  const [subdomainInput, setSubdomainInput] = useState("");

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const isAvailable = await getAvailability(subdomainInput);
    if (!isAvailable) {
      toast(
        l10n.getString("error-subdomain-not-available-2", {
          unavailable_subdomain: subdomainInput,
        }),
        { type: "error" }
      );
      return;
    }

    props.onPick(subdomainInput.toLowerCase());
  };

  const onInput: ChangeEventHandler<HTMLInputElement> = async (event) => {
    setSubdomainInput(event.target.value);
    props.onType(event.target.value.toLowerCase());
  };

  return (
    <form onSubmit={onSubmit}>
      <VisuallyHidden>
        <label htmlFor="subdomain">
          {l10n.getString("banner-choose-subdomain-input-placeholder-3")}
        </label>
      </VisuallyHidden>
      <input
        type="search"
        value={subdomainInput}
        onInput={onInput}
        placeholder={l10n.getString(
          "banner-choose-subdomain-input-placeholder-3"
        )}
        name="subdomain"
        id="subdomain"
        minLength={1}
        maxLength={63}
        autoCapitalize="none"
      />
      <Button type="submit">
        {l10n.getString("banner-register-subdomain-button-search")}
      </Button>
    </form>
  );
};

async function getAvailability(subdomain: string) {
  const checkResponse = await authenticatedFetch(
    `/accounts/profile/subdomain?subdomain=${subdomain}`
  );
  if (!checkResponse.ok) {
    return false;
  }
  const checkData: { available: true } = await checkResponse.json();
  return checkData.available;
}
