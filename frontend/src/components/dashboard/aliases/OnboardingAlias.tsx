import { useState, ReactNode } from "react";
import { AliasData } from "../../../hooks/api/aliases";
import { ProfileData } from "../../../hooks/api/profile";
import { UserData } from "../../../hooks/api/user";
import { RuntimeData } from "../../../hooks/api/runtimeData";
import { useLocalLabels } from "../../../hooks/localLabels";
import { useL10n } from "../../../hooks/l10n";
import { MaskCard } from "./MaskCard";

export type Props = {
  aliases: AliasData[];
  profile: ProfileData;
  user: UserData;
  runtimeData?: RuntimeData;
  onUpdate: (alias: AliasData, updatedFields: Partial<AliasData>) => void;
  children?: ReactNode;
};

export const OnBoardingAlias = (props: Props) => {
  const l10n = useL10n();
  const [localLabels, storeLocalLabel] = useLocalLabels();

  const [openAlias, setOpenAlias] = useState<AliasData | undefined>(
    // If the mask was focused on by an anchor link, expand that one on page load:
    props.aliases.find(
      (alias) =>
        alias.full_address ===
        decodeURIComponent(document.location.hash.substring(1)),
    ),
  );

  if (props.aliases.length === 0) {
    return null;
  }

  const firstAlias = props.aliases[0]; // Get the first alias from the array

  const onUpdate = (updatedFields: Partial<AliasData>) => {
    if (
      localLabels !== null &&
      typeof updatedFields.description === "string" &&
      props.profile.server_storage === false
    ) {
      storeLocalLabel(firstAlias, updatedFields.description);
      delete updatedFields.description;
    }
    return props.onUpdate(firstAlias, updatedFields);
  };

  const onChangeOpen = (isOpen: boolean) => {
    if (isOpen === true) {
      setOpenAlias(firstAlias);
    } else if (openAlias !== undefined && openAlias.id === firstAlias.id) {
      setOpenAlias(undefined);
    }
  };

  const isOpen =
    openAlias !== undefined &&
    openAlias.id === firstAlias.id &&
    openAlias.mask_type === firstAlias.mask_type;

  return (
    <>
      <MaskCard
        mask={firstAlias}
        user={props.user}
        profile={props.profile}
        onUpdate={onUpdate}
        onDelete={() => {}}
        isOpen={isOpen}
        isOnboarding={true}
        onChangeOpen={onChangeOpen}
        showLabelEditor={props.profile.server_storage || localLabels !== null}
        runtimeData={props.runtimeData}
        placeholder={l10n.getString(
          "profile-free-onboarding--copy-mask-email-mask-label",
        )}
      />
      {!isOpen && props.children}
    </>
  );
};
