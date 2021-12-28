import { SWRResponse } from "swr";
import { apiFetch, useApiV1 } from "./api";

export type ProfileData = {
  id: number;
  server_storage: boolean;
  has_premium: boolean;
  subdomain: string | null;
  onboarding_state: number;
  avatar: string;
  api_token: string;
};

export type ProfilesData = [ProfileData];

export type ProfileUpdateFn = (
  id: ProfileData["id"],
  data: Partial<ProfileData>
) => Promise<Response>;

export function useProfiles(): SWRResponse<ProfilesData, unknown> & {
  update: ProfileUpdateFn;
} {
  const profiles: SWRResponse<ProfilesData, unknown> = useApiV1("/profiles/");

  const update: ProfileUpdateFn = async (id, data) => {
    const response = await apiFetch(`/profiles/${id}/`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    profiles.mutate();
    return response;
  };

  return {
    ...profiles,
    update: update,
  };
}
