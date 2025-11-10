import { mockConfigModule } from "../../../__mocks__/configMock";
import { mockUseL10nModule } from "../../../__mocks__/hooks/l10n";
import { renderHook, waitFor } from "@testing-library/react";

import { useApiV1 } from "./api";
import { toast } from "react-toastify";

jest.mock("../../config.ts", () => mockConfigModule);
jest.mock("../../hooks/l10n.ts", () => mockUseL10nModule);
jest.mock("react-toastify", () => ({
  toast: jest.fn(),
}));
global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});
describe("useApiV1", () => {
  it("shows returns the correct data when we have a 200", async () => {
    const mockRuntimeConfig = mockConfigModule.getRuntimeConfig();
    mockConfigModule.getRuntimeConfig.mockReturnValueOnce({
      ...mockRuntimeConfig,
    });
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ test_key: "test_val" }),
    } as Response;
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
    const { result } = renderHook(() =>
      useApiV1("/realphone", { dedupingInterval: 0 }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ test_key: "test_val" });
    });
  });

  it("shows a toast when we 500", async () => {
    const mockRuntimeConfig = mockConfigModule.getRuntimeConfig();
    mockConfigModule.getRuntimeConfig.mockReturnValueOnce({
      ...mockRuntimeConfig,
    });
    const mockResponse2 = {
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response;
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse2);
    const { result } = renderHook(() =>
      useApiV1("/realphone", { dedupingInterval: 0 }),
    );

    await waitFor(() => {
      expect(result.current.error?.response.status).toEqual(500);
      expect(toast).toHaveBeenCalledWith(
        "l10n string: [error-general], with vars: {}",
        { type: "error" },
      );
    });
  });
});
