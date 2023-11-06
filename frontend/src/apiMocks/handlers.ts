import { http, HttpHandler, HttpResponse } from "msw";
import { CustomAliasData, RandomAliasData } from "../hooks/api/aliases";
import { UnverifiedPhone, VerifiedPhone } from "../hooks/api/realPhone";
import { RelayNumber } from "../hooks/api/relayNumber";
import { ProfileData } from "../hooks/api/profile";
import {
  mockIds,
  mockedDomainaddresses,
  mockedProfiles,
  mockedRelayaddresses,
  mockedRuntimeData,
  mockedUsers,
  mockedRealphones,
  mockedRelaynumbers,
  mockedInboundContacts,
} from "./mockData";

export function getHandlers(
  defaultMockId: null | (typeof mockIds)[number] = null,
): HttpHandler[] {
  const handlers: HttpHandler[] = [];

  const getMockId = (req: Request): (typeof mockIds)[number] | null => {
    const authHeader = req.headers.get("Authorization");
    if (typeof authHeader !== "string") {
      return defaultMockId;
    }

    const token = authHeader.split(" ")[1];
    return mockIds.find((mockId) => mockId === token) ?? defaultMockId;
  };

  const addGetHandler: (...args: Parameters<typeof http.get>) => void = (
    path,
    resolver,
  ) => {
    handlers.push(http.get(path, resolver));
    handlers.push(http.get(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addPatchHandler: (...args: Parameters<typeof http.patch>) => void = (
    path,
    resolver,
  ) => {
    handlers.push(http.patch(path, resolver));
    handlers.push(http.patch(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addPostHandler: (...args: Parameters<typeof http.post>) => void = (
    path,
    resolver,
  ) => {
    handlers.push(http.post(path, resolver));
    handlers.push(http.post(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addDeleteHandler: (...args: Parameters<typeof http.delete>) => void = (
    path,
    resolver,
  ) => {
    handlers.push(http.delete(path, resolver));
    handlers.push(http.delete(`http://127.0.0.1:8000${path}`, resolver));
  };

  addGetHandler("/accounts/logout", (_info) => {
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/runtime_data", (_info) => {
    return HttpResponse.json(mockedRuntimeData, { status: 200 });
  });

  addGetHandler("/api/v1/users/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 401 });
    }

    return HttpResponse.json([mockedUsers[mockId]], { status: 200 });
  });

  addGetHandler("/accounts/profile/subdomain", (info) => {
    const requestUrl = new URL(info.request.url);
    if (requestUrl.searchParams.get("subdomain") === "not-available") {
      return HttpResponse.json(
        {
          message: "error-subdomain-not-available",
          subdomain: "not-available",
        },
        { status: 400 },
      );
    }

    return HttpResponse.json({ available: true }, { status: 200 });
  });

  addPostHandler("/accounts/profile/subdomain", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const body = await info.request.text();
    const data = new URLSearchParams(body);
    mockedProfiles[mockId] = {
      ...mockedProfiles[mockId],
      subdomain: data.get("subdomain"),
    };
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/profiles/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 401 });
    }

    return HttpResponse.json([mockedProfiles[mockId]], { status: 200 });
  });

  addPatchHandler("/api/v1/profiles/:id/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const body = (await info.request.json()) as Partial<ProfileData>;
    mockedProfiles[mockId] = {
      ...mockedProfiles[mockId],
      ...body,
    };
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/relayaddresses/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(mockedRelayaddresses[mockId], { status: 200 });
  });

  addPostHandler("/api/v1/relayaddresses/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const body = (await info.request.json()) as Partial<RandomAliasData>;
    const ownAddresses = mockedRelayaddresses[mockId];
    const id = (ownAddresses[ownAddresses.length - 1]?.id ?? -1) + 1;
    ownAddresses.push({
      address: body.address ?? `random_${id}`,
      full_address: body.address ?? `random_${id}` + "@mozmail.com",
      created_at: new Date(Date.now()).toISOString(),
      description: "",
      domain: 1,
      enabled: true,
      block_list_emails: body.block_list_emails ?? false,
      block_level_one_trackers: body.block_level_one_trackers ?? false,
      generated_for: "",
      id: id,
      last_modified_at: new Date(Date.now()).toISOString(),
      last_used_at: new Date(Date.now()).toISOString(),
      num_blocked: 0,
      num_replied: 0,
      num_forwarded: 0,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      mask_type: "random",
      used_on: "",
    });
    return HttpResponse.text(null, { status: 200 });
  });

  addPatchHandler("/api/v1/relayaddresses/:id/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const ownAddresses = mockedRelayaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(info.params.id as string, 10),
    );
    if (index === -1) {
      return HttpResponse.text(null, { status: 404 });
    }
    const body = (await info.request.json()) as Partial<RandomAliasData>;
    ownAddresses[index] = {
      ...ownAddresses[index],
      ...body,
    };
    return HttpResponse.text(null, { status: 200 });
  });

  addDeleteHandler("/api/v1/relayaddresses/:id/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const ownAddresses = mockedRelayaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(info.params.id as string, 10),
    );
    if (index === -1) {
      return HttpResponse.text(null, { status: 404 });
    }

    ownAddresses.splice(index, 1);
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/domainaddresses/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(mockedDomainaddresses[mockId], { status: 200 });
  });

  addPostHandler("/api/v1/domainaddresses/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const body = (await info.request.json()) as Partial<CustomAliasData>;
    const ownAddresses = mockedDomainaddresses[mockId];
    const id = (ownAddresses[ownAddresses.length - 1]?.id ?? -1) + 1;
    ownAddresses.push({
      address: body.address ?? `custom_alias_${id}`,
      full_address:
        body.address ?? `custom_alias_${id}` + "@mydomain.mozmail.com",
      created_at: new Date(Date.now()).toISOString(),
      description: "",
      domain: 2,
      enabled: true,
      block_list_emails: body.block_list_emails ?? false,
      block_level_one_trackers: body.block_level_one_trackers ?? false,
      id: id,
      last_modified_at: new Date(Date.now()).toISOString(),
      last_used_at: new Date(Date.now()).toISOString(),
      num_blocked: 0,
      num_replied: 0,
      num_forwarded: 0,
      num_spam: 0,
      num_level_one_trackers_blocked: 0,
      used_on: "",
      mask_type: "custom",
    });
    return HttpResponse.text(null, { status: 200 });
  });

  addPatchHandler("/api/v1/domainaddresses/:id/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const ownAddresses = mockedDomainaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(info.params.id as string, 10),
    );
    if (index === -1) {
      return HttpResponse.text(null, { status: 404 });
    }

    const body = (await info.request.json()) as Partial<CustomAliasData>;
    ownAddresses[index] = {
      ...ownAddresses[index],
      ...body,
    };
    return HttpResponse.text(null, { status: 200 });
  });

  addDeleteHandler("/api/v1/domainaddresses/:id/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const ownAddresses = mockedDomainaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(info.params.id as string, 10),
    );
    if (index === -1) {
      return HttpResponse.text(null, { status: 404 });
    }

    ownAddresses.splice(index, 1);
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/realphone/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(mockedRealphones[mockId], { status: 200 });
  });
  addPostHandler("/api/v1/realphone/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    type NewNumber = Pick<UnverifiedPhone, "number">;
    type Verification = Pick<VerifiedPhone, "number" | "verification_code">;
    const body = (await info.request.json()) as NewNumber | Verification;

    const isVerification = (
      request: NewNumber | Verification,
    ): request is Verification => {
      return typeof (request as Verification).verification_code === "string";
    };

    if (isVerification(body)) {
      mockedRealphones[mockId] = mockedRealphones[mockId].map((realPhone) => {
        if (realPhone.number !== body.number) {
          return realPhone;
        }

        return {
          ...realPhone,
          verified: true,
          verified_date: new Date().toISOString(),
        } as VerifiedPhone;
      });
    } else {
      // Pretend the verification was sent 4:40m ago,
      // so expiry can easily be tested:
      const sentDate = Date.now() - 5 * 60 * 1000 + 20 * 1000;
      const newVerificationPendingPhone: UnverifiedPhone = {
        id: mockedRealphones[mockId].length,
        number: body.number,
        verification_code: "123456",
        verification_sent_date: new Date(sentDate).toISOString(),
        verified: false,
        verified_date: null,
        country_code: "US",
      };
      mockedRealphones[mockId].push(newVerificationPendingPhone);
    }
    return HttpResponse.text(null, { status: 200 });
  });
  addGetHandler("/api/v1/realphone/:id/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }
    const relevantRealPhone = mockedRealphones[mockId].find(
      (realPhone) =>
        realPhone.id === Number.parseInt(info.params.id as string, 10),
    );
    return HttpResponse.json(relevantRealPhone, { status: 200 });
  });
  addPatchHandler("/api/v1/realphone/:id/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }
    type Verification = Pick<VerifiedPhone, "number" | "verification_code">;
    const body = (await info.request.json()) as Verification;
    mockedRealphones[mockId] = mockedRealphones[mockId].map((realPhone) => {
      if (
        realPhone.number !== body.number ||
        realPhone.id !== Number.parseInt(info.params.id as string, 10)
      ) {
        return realPhone;
      }

      return {
        ...realPhone,
        verified: true,
        verified_date: new Date().toISOString(),
      } as VerifiedPhone;
    });
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/relaynumber/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(mockedRelaynumbers[mockId], { status: 200 });
  });
  addPostHandler("/api/v1/relaynumber/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const body = (await info.request.json()) as Pick<RelayNumber, "number">;

    const newRelaynumber: RelayNumber = {
      number: body.number,
      location: "Unhošť",
      country_code: "US",
      enabled: true,
      id: mockedRelaynumbers[mockId].length,
      remaining_texts: 74,
      remaining_minutes: 49,
      calls_forwarded: 3,
      calls_blocked: 1,
      texts_forwarded: 17,
      texts_blocked: 5,
      calls_and_texts_forwarded: 20,
      calls_and_texts_blocked: 6,
    };
    mockedRelaynumbers[mockId].push(newRelaynumber);
    return HttpResponse.json(newRelaynumber, { status: 200 });
  });

  // TODO: Move to phone API hook:
  type TwilioPhone = {
    phone_number: string;
    locality: string;
    // See convert_twilio_numbers_to_dict in phones/models.py for other fields.
  };

  addGetHandler("/api/v1/relaynumber/search/", (info) => {
    const requestUrl = new URL(info.request.url);
    const location = requestUrl.searchParams.get("location");
    const areaCode = requestUrl.searchParams.get("area_code");

    if (location === null && areaCode === null) {
      return HttpResponse.json({}, { status: 404 });
    }

    const mockedSearchResults: TwilioPhone[] = Array.from(new Array(10), () => {
      const numberEnd = Math.random().toString().substring(4, 7);
      return {
        phone_number: `+1${areaCode ?? "808"}${numberEnd}`,
        locality: location ?? "Hilo",
      };
    });

    return HttpResponse.json(mockedSearchResults, { status: 200 });
  });

  addGetHandler("/api/v1/relaynumber/suggestions/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const userNumber = mockedRealphones[mockId][0]?.number ?? "+18089251571";

    const mockedSuggestions = {
      same_prefix_options: Array.from(new Array(10), (_, index) => {
        const suffixNum =
          Number.parseInt(userNumber.substring(10), 10) + 1 + index;
        const suggestedNumber: TwilioPhone = {
          phone_number: userNumber.substring(0, 10) + suffixNum.toString(),
          locality: "Hilo",
        };
        return suggestedNumber;
      }),
      other_areas_options: Array.from(new Array(10), () => {
        const areaCode = Math.random().toString().substring(2, 5);
        const suggestedNumber: TwilioPhone = {
          phone_number:
            userNumber.substring(0, 2) + areaCode + userNumber.substring(5),
          locality: "Hilo",
        };
        return suggestedNumber;
      }),
      same_area_options: Array.from(new Array(10), () => {
        const suffixNum = Math.random().toString().substring(2, 9);
        const suggestedNumber: TwilioPhone = {
          phone_number: userNumber.substring(0, 5) + suffixNum.toString(),
          locality: "Hilo",
        };
        return suggestedNumber;
      }),
      random_options: Array.from(new Array(10), () => {
        const suffixNum = Math.random().toString().substring(2, 12);
        const randomNumber: TwilioPhone = {
          phone_number: userNumber.substring(0, 2) + suffixNum.toString(),
          locality: "Hilo",
        };
        return randomNumber;
      }),
    };

    return HttpResponse.json(mockedSuggestions, { status: 200 });
  });

  addGetHandler("/api/v1/relaynumber/:id/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(
      mockedRelaynumbers[mockId][Number.parseInt(info.params.id as string, 10)],
      { status: 200 },
    );
  });

  addPatchHandler("/api/v1/relaynumber/:id/", async (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    const ownRelayNumbers = mockedRelaynumbers[mockId];
    const index = ownRelayNumbers.findIndex(
      (relayNumber) =>
        relayNumber.id === Number.parseInt(info.params.id as string, 10),
    );
    if (index === -1) {
      return HttpResponse.text(null, { status: 404 });
    }

    const body = (await info.request.json()) as Partial<RelayNumber>;
    ownRelayNumbers[index] = {
      ...ownRelayNumbers[index],
      ...body,
    };
    return HttpResponse.text(null, { status: 200 });
  });

  addGetHandler("/api/v1/inboundcontact/", (info) => {
    const mockId = getMockId(info.request);
    if (mockId === null) {
      return HttpResponse.text(null, { status: 400 });
    }

    return HttpResponse.json(mockedInboundContacts[mockId], { status: 200 });
  });

  handlers.push(
    http.post("https://basket-mock.com/news/subscribe/", (_info) => {
      return HttpResponse.json({ status: "ok" }, { status: 200 });
    }),
  );
  handlers.push(
    http.get("https://accounts.firefox.com/metrics-flow", (_info) => {
      return HttpResponse.json(
        {
          flowId: "mock-flow-id",
          flowBeginTime: Date.now(),
        },
        { status: 200 },
      );
    }),
  );

  return handlers;
}
export const handlers: HttpHandler[] = getHandlers();
