import { useLocalization } from "@fluent/react";
import { FormEventHandler, useState } from "react";
import { VisuallyHidden } from "react-aria";
import { toast } from "react-toastify";
import { authenticatedFetch } from "../../../hooks/api/api";
import { Button } from "../../Button";

export type Props = {
  onPick: (_subdomain: string) => void;
};

export const SubdomainSearchForm = (props: Props) => {
  const { l10n } = useLocalization();
  const [subdomainInput, setSubdomainInput] = useState("");

  const onSubmit: FormEventHandler = async (event) => {
    event.preventDefault();

    const isAvailable = await getAvailability(subdomainInput);
    if (!isAvailable) {
      toast(
        l10n.getString("error-subdomain-not-available", {
          unavailable_subdomain: subdomainInput,
        }),
        { type: "error" }
      );
      return;
    }

    props.onPick(subdomainInput);
  };

  return (
    <form onSubmit={onSubmit}>
      <VisuallyHidden>
        <label htmlFor="subdomain">
          {l10n.getString("banner-choose-subdomain-input-placeholder")}
        </label>
      </VisuallyHidden>
      <input
        type="search"
        value={subdomainInput}
        onChange={(e) => setSubdomainInput(e.target.value)}
        placeholder={l10n.getString(
          "banner-choose-subdomain-input-placeholder"
        )}
        name="subdomain"
        id="subdomain"
        minLength={1}
        maxLength={63}
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
