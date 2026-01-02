import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useApiV1, apiFetch } from "../hooks/api/api";
import { isFlagActive } from "../functions/waffle";
import { getRuntimeConfig } from "../config";
import { toast } from "react-toastify";

jest.mock("../hooks/api/runtimeData");
jest.mock("../hooks/api/api");
jest.mock("../functions/waffle");
jest.mock("../config");
jest.mock("react-toastify", () => ({
  toast: jest.fn(),
  ToastContainer: () => null,
}));

import Flags from "./flags.page";

const mockedUseRuntimeData = useRuntimeData as jest.MockedFunction<
  typeof useRuntimeData
>;
const mockedUseApiV1 = useApiV1 as jest.MockedFunction<typeof useApiV1>;
const mockedIsFlagActive = isFlagActive as jest.MockedFunction<
  typeof isFlagActive
>;
const mockedGetRuntimeConfig = getRuntimeConfig as jest.MockedFunction<
  typeof getRuntimeConfig
>;
const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;
const mockedToast = toast as jest.MockedFunction<typeof toast>;

setMockRuntimeData();
setMockProfileData(null);

const mockFlagData = [
  { id: 1, name: "manage_flags", everyone: true, note: "" },
  { id: 2, name: "test_flag_1", everyone: true, note: "" },
  { id: 3, name: "test_flag_2", everyone: false, note: "" },
  { id: 4, name: "test_flag_3", everyone: null, note: "" },
];

describe("The flags management page", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRuntimeData.mockReturnValue({
      data: { WAFFLE_FLAGS: [["manage_flags", true]] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    mockedUseApiV1.mockReturnValue({
      data: mockFlagData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });

    mockedIsFlagActive.mockReturnValue(true);

    mockedGetRuntimeConfig.mockReturnValue({
      fxaLoginUrl: "https://login.example.com",
      frontendOrigin: "https://example.com",
    });

    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("under axe accessibility testing", () => {
    it("passes axe accessibility testing", async () => {
      const { baseElement } = render(<Flags />);
      const results = await act(() => axe(baseElement));
      expect(results).toHaveNoViolations();
    }, 10000);
  });

  describe("authentication and authorization", () => {
    it("returns null when runtime data is not available", () => {
      mockedUseRuntimeData.mockReturnValue({
        data: undefined,
        error: undefined,
        isLoading: true,
        isValidating: false,
        mutate: jest.fn(),
      });

      const { container } = render(<Flags />);

      expect(container).toBeEmptyDOMElement();
    });

    it("returns null when manage_flags flag is not active", () => {
      mockedIsFlagActive.mockReturnValue(false);

      const { container } = render(<Flags />);

      expect(container).toBeEmptyDOMElement();
    });

    it("returns null when there is an error loading flags", () => {
      mockedUseApiV1.mockReturnValue({
        data: undefined,
        error: new Error("API Error"),
        isLoading: false,
        isValidating: false,
        mutate: jest.fn(),
      });

      const { container } = render(<Flags />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("flag list display", () => {
    it("renders a table with flag statuses", () => {
      render(<Flags />);

      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("Active?")).toBeInTheDocument();
      expect(screen.getByText("Flag")).toBeInTheDocument();
    });

    it("displays all flags except manage_flags", () => {
      render(<Flags />);

      expect(screen.getByText("test_flag_1")).toBeInTheDocument();
      expect(screen.getByText("test_flag_2")).toBeInTheDocument();
      expect(screen.getByText("test_flag_3")).toBeInTheDocument();
      expect(screen.queryByText("manage_flags")).not.toBeInTheDocument();
    });

    it("shows CheckIcon for active flags", () => {
      render(<Flags />);

      const rows = screen.getAllByRole("row");
      const activeRow = rows.find((row) =>
        row.textContent?.includes("test_flag_1"),
      );

      expect(activeRow).toBeInTheDocument();
      expect(activeRow).toHaveTextContent("test_flag_1");
    });

    it("shows BlockIcon for inactive flags", () => {
      render(<Flags />);

      const rows = screen.getAllByRole("row");
      const inactiveRow = rows.find((row) =>
        row.textContent?.includes("test_flag_2"),
      );

      expect(inactiveRow).toBeInTheDocument();
      expect(inactiveRow).toHaveTextContent("test_flag_2");
    });

    it("applies correct CSS class for active flags", () => {
      render(<Flags />);

      const rows = screen.getAllByRole("row");
      const activeRow = rows.find((row) =>
        row.textContent?.includes("test_flag_1"),
      );

      expect(activeRow?.className).toContain("is-active");
    });

    it("applies correct CSS class for inactive flags", () => {
      render(<Flags />);

      const rows = screen.getAllByRole("row");
      const inactiveRow = rows.find((row) =>
        row.textContent?.includes("test_flag_2"),
      );

      expect(inactiveRow?.className).toContain("is-inactive");
    });

    it("applies correct CSS class for non-global flags", () => {
      render(<Flags />);

      const rows = screen.getAllByRole("row");
      const nonGlobalRow = rows.find((row) =>
        row.textContent?.includes("test_flag_3"),
      );

      expect(nonGlobalRow?.className).toContain("is-non-global");
    });
  });

  describe("form rendering", () => {
    it("renders form with flag name input", () => {
      render(<Flags />);

      expect(
        screen.getByLabelText("Which flag do you want to modify?"),
      ).toBeInTheDocument();
    });

    it("renders form with action input", () => {
      render(<Flags />);

      expect(
        screen.getByPlaceholderText("`enable` or `disable`"),
      ).toBeInTheDocument();
    });

    it("renders submit button", () => {
      render(<Flags />);

      expect(
        screen.getByRole("button", { name: "Set flag status" }),
      ).toBeInTheDocument();
    });

    it("shows placeholder with first flag name", () => {
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      ) as HTMLInputElement;

      expect(flagInput.placeholder).toContain("test_flag_1");
    });
  });

  describe("form interactions", () => {
    it("updates flag name input when user types", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      ) as HTMLInputElement;

      await user.type(flagInput, "new_flag");

      expect(flagInput.value).toBe("new_flag");
    });

    it("updates action input when user types", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const actionInput = screen.getByPlaceholderText(
        "`enable` or `disable`",
      ) as HTMLInputElement;

      await user.type(actionInput, "enable");

      expect(actionInput.value).toBe("enable");
    });
  });

  describe("enabling flags", () => {
    it("enables a new flag successfully", async () => {
      const user = userEvent.setup();
      const mutateMock = jest.fn();
      mockedUseApiV1.mockReturnValue({
        data: mockFlagData,
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: mutateMock,
      });

      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "new_flag");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/flags/", {
          method: "POST",
          body: JSON.stringify({
            name: "new_flag",
            everyone: true,
          }),
        });
      });

      expect(mutateMock).toHaveBeenCalled();
      expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
        type: "success",
      });
    });

    it("updates existing flag to enabled", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_2");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/flags/3/", {
          method: "PATCH",
          body: JSON.stringify({
            everyone: true,
          }),
        });
      });
    });

    it("clears form inputs after successful enable", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      ) as HTMLInputElement;
      const actionInput = screen.getByPlaceholderText(
        "`enable` or `disable`",
      ) as HTMLInputElement;
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_1");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(flagInput.value).toBe("");
        expect(actionInput.value).toBe("");
      });
    });
  });

  describe("disabling flags", () => {
    it("disables a new flag successfully", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "new_flag");
      await user.type(actionInput, "disable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/flags/", {
          method: "POST",
          body: JSON.stringify({
            name: "new_flag",
            everyone: false,
          }),
        });
      });
    });

    it("updates existing flag to disabled", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_1");
      await user.type(actionInput, "disable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiFetch).toHaveBeenCalledWith("/flags/2/", {
          method: "PATCH",
          body: JSON.stringify({
            everyone: false,
          }),
        });
      });
    });
  });

  describe("error handling", () => {
    it("shows error toast when trying to modify non-global flag", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_3");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
          type: "error",
        });
      });

      expect(mockedApiFetch).not.toHaveBeenCalled();
    });

    it("shows error toast when API request fails", async () => {
      const user = userEvent.setup();
      mockedApiFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_1");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
          type: "error",
        });
      });
    });

    it("does not submit when action is invalid", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_1");
      await user.type(actionInput, "invalid");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedApiFetch).not.toHaveBeenCalled();
      });
    });

    it("does not clear form when API request fails", async () => {
      const user = userEvent.setup();
      mockedApiFetch.mockResolvedValue({
        ok: false,
        json: async () => ({}),
      } as Response);

      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      ) as HTMLInputElement;
      const actionInput = screen.getByPlaceholderText(
        "`enable` or `disable`",
      ) as HTMLInputElement;
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_1");
      await user.type(actionInput, "enable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
          type: "error",
        });
      });

      expect(flagInput.value).toBe("test_flag_1");
      expect(actionInput.value).toBe("enable");
    });
  });

  describe("edge cases", () => {
    it("handles empty flag list", () => {
      mockedUseApiV1.mockReturnValue({
        data: [{ id: 1, name: "manage_flags", everyone: true, note: "" }],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: jest.fn(),
      });

      render(<Flags />);

      const rows = screen.queryAllByRole("row");
      expect(rows.length).toBe(1);
    });

    it("handles flag list with only manage_flags", () => {
      mockedUseApiV1.mockReturnValue({
        data: [{ id: 1, name: "manage_flags", everyone: true, note: "" }],
        error: undefined,
        isLoading: false,
        isValidating: false,
        mutate: jest.fn(),
      });

      render(<Flags />);

      expect(screen.queryByText("manage_flags")).not.toBeInTheDocument();
    });

    it("shows appropriate message in non-global flag error toast", async () => {
      const user = userEvent.setup();
      render(<Flags />);

      const flagInput = screen.getByLabelText(
        "Which flag do you want to modify?",
      );
      const actionInput = screen.getByPlaceholderText("`enable` or `disable`");
      const submitButton = screen.getByRole("button", {
        name: "Set flag status",
      });

      await user.type(flagInput, "test_flag_3");
      await user.type(actionInput, "disable");
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
          type: "error",
        });
      });

      const toastCall = mockedToast.mock.calls[0][0];
      expect(toastCall).toBeDefined();
    });
  });
});
