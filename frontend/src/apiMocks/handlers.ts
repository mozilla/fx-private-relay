import { rest, RestHandler, RestRequest } from "msw";
import { CustomAliasData, RandomAliasData } from "../hooks/api/aliases";
import { UnverifiedPhone, VerifiedPhone } from "../hooks/api/phone";
import { ProfileData } from "../hooks/api/profile";
import {
  mockIds,
  mockedDomainaddresses,
  mockedProfiles,
  mockedRelayaddresses,
  mockedRuntimeData,
  mockedUsers,
  mockedRealphones,
} from "./mockData";

export function getHandlers(
  defaultMockId: null | typeof mockIds[number] = null
): RestHandler[] {
  const handlers: RestHandler[] = [];

  const getMockId = (req: RestRequest): typeof mockIds[number] | null => {
    const authHeader = req.headers.get("Authorization");
    if (typeof authHeader !== "string") {
      return defaultMockId;
    }

    const token = authHeader.split(" ")[1];
    return mockIds.find((mockId) => mockId === token) ?? defaultMockId;
  };

  const addGetHandler: (...args: Parameters<typeof rest.get>) => void = (
    path,
    resolver
  ) => {
    handlers.push(rest.get(path, resolver));
    handlers.push(rest.get(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addPatchHandler: (...args: Parameters<typeof rest.patch>) => void = (
    path,
    resolver
  ) => {
    handlers.push(rest.patch(path, resolver));
    handlers.push(rest.patch(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addPostHandler: (...args: Parameters<typeof rest.post>) => void = (
    path,
    resolver
  ) => {
    handlers.push(rest.post(path, resolver));
    handlers.push(rest.post(`http://127.0.0.1:8000${path}`, resolver));
  };
  const addDeleteHandler: (...args: Parameters<typeof rest.delete>) => void = (
    path,
    resolver
  ) => {
    handlers.push(rest.delete(path, resolver));
    handlers.push(rest.delete(`http://127.0.0.1:8000${path}`, resolver));
  };

  addGetHandler("/accounts/logout", (_req, res, _ctx) => {
    return res();
  });

  addGetHandler("/api/v1/runtime_data", (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json(mockedRuntimeData));
  });

  addGetHandler("/api/v1/users/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(403));
    }

    return res(ctx.status(200), ctx.json([mockedUsers[mockId]]));
  });

  addGetHandler("/accounts/profile/subdomain", (req, res, ctx) => {
    if (req.url.searchParams.get("subdomain") === "not-available") {
      return res(
        ctx.status(400),
        ctx.json({
          message: "error-subdomain-not-available",
          subdomain: "not-available",
        })
      );
    }

    return res(ctx.status(200), ctx.json({ available: true }));
  });

  addPostHandler("/accounts/profile/subdomain", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const body = req.body as string;
    const data = new URLSearchParams(body);
    mockedProfiles[mockId] = {
      ...mockedProfiles[mockId],
      subdomain: data.get("subdomain"),
    };
    return res(ctx.status(200));
  });

  addGetHandler("/api/v1/profiles/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(403));
    }

    return res(ctx.status(200), ctx.json([mockedProfiles[mockId]]));
  });

  addPatchHandler("/api/v1/profiles/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const body = req.body as Partial<ProfileData>;
    mockedProfiles[mockId] = {
      ...mockedProfiles[mockId],
      ...body,
    };
    return res(ctx.status(200));
  });

  addGetHandler("/api/v1/relayaddresses/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    return res(ctx.status(200), ctx.json(mockedRelayaddresses[mockId]));
  });

  addPostHandler("/api/v1/relayaddresses/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const body = req.body as Partial<RandomAliasData>;
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
    return res(ctx.status(200));
  });

  addPatchHandler("/api/v1/relayaddresses/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const ownAddresses = mockedRelayaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(req.params.id as string, 10)
    );
    if (index === -1) {
      return res(ctx.status(404));
    }
    const body = req.body as Partial<RandomAliasData>;
    ownAddresses[index] = {
      ...ownAddresses[index],
      ...body,
    };
    return res(ctx.status(200));
  });

  addDeleteHandler("/api/v1/relayaddresses/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const ownAddresses = mockedRelayaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(req.params.id as string, 10)
    );
    if (index === -1) {
      return res(ctx.status(404));
    }

    ownAddresses.splice(index, 1);
    return res(ctx.status(200));
  });

  addGetHandler("/api/v1/domainaddresses/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    return res(ctx.status(200), ctx.json(mockedDomainaddresses[mockId]));
  });

  addPostHandler("/api/v1/domainaddresses/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const body = req.body as Partial<CustomAliasData>;
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
    return res(ctx.status(200));
  });

  addPatchHandler("/api/v1/domainaddresses/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const ownAddresses = mockedDomainaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(req.params.id as string, 10)
    );
    if (index === -1) {
      return res(ctx.status(404));
    }

    const body = req.body as Partial<CustomAliasData>;
    ownAddresses[index] = {
      ...ownAddresses[index],
      ...body,
    };
    return res(ctx.status(200));
  });

  addDeleteHandler("/api/v1/domainaddresses/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    const ownAddresses = mockedDomainaddresses[mockId];
    const index = ownAddresses.findIndex(
      (address) => address.id === Number.parseInt(req.params.id as string, 10)
    );
    if (index === -1) {
      return res(ctx.status(404));
    }

    ownAddresses.splice(index, 1);
    return res(ctx.status(200));
  });

  addGetHandler("/api/v1/realphone/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    return res(ctx.status(200), ctx.json(mockedRealphones[mockId]));
  });
  addPostHandler("/api/v1/realphone/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }

    type NewNumber = Pick<UnverifiedPhone, "number">;
    type Verification = Pick<VerifiedPhone, "number" | "verification_code">;
    const body = req.body as NewNumber | Verification;

    const isVerification = (
      request: NewNumber | Verification
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
      const newUnverifiedPhone: UnverifiedPhone = {
        id: mockedRealphones[mockId].length,
        number: body.number,
        verification_code: "123456",
        verification_sent_date: new Date(sentDate).toISOString(),
        verified: false,
        verified_date: null,
      };
      mockedRealphones[mockId].push(newUnverifiedPhone);
    }
    return res(ctx.status(200));
  });
  addGetHandler("/api/v1/realphone/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }
    const relevantRealPhone = mockedRealphones[mockId].find(
      (realPhone) =>
        realPhone.id === Number.parseInt(req.params.id as string, 10)
    );
    return res(ctx.status(200), ctx.json(relevantRealPhone));
  });
  addPatchHandler("/api/v1/realphone/:id/", (req, res, ctx) => {
    const mockId = getMockId(req);
    if (mockId === null) {
      return res(ctx.status(400));
    }
    type Verification = Pick<VerifiedPhone, "number" | "verification_code">;
    const body = req.body as Verification;
    mockedRealphones[mockId] = mockedRealphones[mockId].map((realPhone) => {
      if (
        realPhone.number !== body.number ||
        realPhone.id !== Number.parseInt(req.params.id as string, 10)
      ) {
        return realPhone;
      }

      return {
        ...realPhone,
        verified: true,
        verified_date: new Date().toISOString(),
      } as VerifiedPhone;
    });
    return res(ctx.status(200));
  });

  handlers.push(
    rest.post("https://basket-mock.com/news/subscribe/", (_req, res, ctx) => {
      return res(ctx.status(200), ctx.json({ status: "ok" }));
    })
  );
  handlers.push(
    rest.get("https://accounts.firefox.com/metrics-flow", (_req, res, ctx) => {
      return res(
        ctx.status(200),
        ctx.json({
          flowId: "mock-flow-id",
          flowBeginTime: Date.now(),
        })
      );
    })
  );

  return handlers;
}
export const handlers: RestHandler[] = getHandlers();
