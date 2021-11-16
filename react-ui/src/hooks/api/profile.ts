import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type ProfileData = {
  id: number;
  server_storage: boolean;
  has_premium: boolean;
  subdomain: string | null;
};

export type ProfilesData = [ProfileData];

export type ProfileUpdateFn = (
  id: ProfileData["id"],
  data: Partial<ProfileData>
) => Promise<void>;

export const useProfiles = (): SWRResponse<ProfilesData, unknown> & {
  update: ProfileUpdateFn;
} => {
  const profiles: SWRResponse<ProfilesData, unknown> = useApiV1("/profiles/");

  const update: ProfileUpdateFn = async (id, data) => {
    await apiFetch(`/profiles/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    profiles.mutate();
  };

  return {
    ...profiles,
    update: update,
  };
};
