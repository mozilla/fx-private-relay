import { mockConfigModule } from "../../__mocks__/configMock";
import { getLoginUrl } from "./fxaFlowTracker";

jest.mock("../config.ts", () => mockConfigModule);

const mockFlowBeginTime = new Date("1990-11-12T13:37:42.000Z").getTime();

describe("getLoginUrl", () => {
  it("appends flow data", () => {
    const mockRuntimeConfig = mockConfigModule.getRuntimeConfig();
    mockConfigModule.getRuntimeConfig.mockReturnValueOnce({
      ...mockRuntimeConfig,
      fxaLoginUrl: "https://mock-login.com",
    });
    expect(
      getLoginUrl("some_entrypoint", {
        flowBeginTime: mockFlowBeginTime,
        flowId: "some_flow_id",
      }),
    ).toBe(
      "https://mock-login.com/?form_type=button&entrypoint=some_entrypoint&flowId=some_flow_id&flowBeginTime=" +
        mockFlowBeginTime,
    );
  });

  it("preserves existing query parameters", () => {
    const mockRuntimeConfig = mockConfigModule.getRuntimeConfig();
    mockConfigModule.getRuntimeConfig.mockReturnValueOnce({
      ...mockRuntimeConfig,
      fxaLoginUrl: "https://mock-login.com/?some_query=param",
    });
    expect(
      getLoginUrl("some_entrypoint", {
        flowBeginTime: mockFlowBeginTime,
        flowId: "some_flow_id",
      }),
    ).toBe(
      "https://mock-login.com/?some_query=param&form_type=button&entrypoint=some_entrypoint&flowId=some_flow_id&flowBeginTime=" +
        mockFlowBeginTime,
    );
  });

  it("keeps relative URLs relative", () => {
    const mockRuntimeConfig = mockConfigModule.getRuntimeConfig();
    mockConfigModule.getRuntimeConfig.mockReturnValueOnce({
      ...mockRuntimeConfig,
      fxaLoginUrl: "/login",
    });
    expect(
      getLoginUrl("some_entrypoint", {
        flowBeginTime: mockFlowBeginTime,
        flowId: "some_flow_id",
      }),
    ).toBe(
      "/login?form_type=button&entrypoint=some_entrypoint&flowId=some_flow_id&flowBeginTime=" +
        mockFlowBeginTime,
    );
  });
});
