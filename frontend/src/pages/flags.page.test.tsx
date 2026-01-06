import { act, render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { setMockProfileData } from "../../__mocks__/hooks/api/profile";
import { setMockRuntimeData } from "../../__mocks__/hooks/api/runtimeData";
import { useRuntimeData } from "../hooks/api/runtimeData";
import { useApiV1, apiFetch } from "../hooks/api/api";
import { isFlagActive } from "../functions/waffle";
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

const getFormInputs = () => ({
  flagInput: screen.getByLabelText(
    "Which flag do you want to modify?",
  ) as HTMLInputElement,
  actionInput: screen.getByPlaceholderText(
    "`enable` or `disable`",
  ) as HTMLInputElement,
  submitButton: screen.getByRole("button", { name: "Set flag status" }),
});

const fillAndSubmitForm = async (flagName: string, action: string) => {
  const user = userEvent.setup();
  const { flagInput, actionInput, submitButton } = getFormInputs();

  await user.clear(flagInput);
  await user.clear(actionInput);
  await user.type(flagInput, flagName);
  await user.type(actionInput, action);
  await user.click(submitButton);
};

const expectEmptyForm = () => {
  const { flagInput, actionInput } = getFormInputs();
  expect(flagInput.value).toBe("");
  expect(actionInput.value).toBe("");
};

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

    mockedApiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("passes axe accessibility testing", async () => {
    const { baseElement } = render(<Flags />);
    const results = await act(() => axe(baseElement));
    expect(results).toHaveNoViolations();
  }, 10000);

  it("handles authentication and authorization requirements", () => {
    mockedUseRuntimeData.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: jest.fn(),
    });
    let { container } = render(<Flags />);
    expect(container).toBeEmptyDOMElement();

    cleanup();
    mockedUseRuntimeData.mockReturnValue({
      data: { WAFFLE_FLAGS: [["manage_flags", true]] },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
    mockedIsFlagActive.mockReturnValue(false);
    ({ container } = render(<Flags />));
    expect(container).toBeEmptyDOMElement();

    cleanup();
    mockedIsFlagActive.mockReturnValue(true);
    mockedUseApiV1.mockReturnValue({
      data: undefined,
      error: new Error("API Error"),
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
    ({ container } = render(<Flags />));
    expect(container).toBeEmptyDOMElement();
  });

  it("displays flag list, form, row styles, and handles edge cases", async () => {
    const user = userEvent.setup();
    render(<Flags />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Active?")).toBeInTheDocument();
    expect(screen.getByText("Flag")).toBeInTheDocument();
    expect(screen.getByText("test_flag_1")).toBeInTheDocument();
    expect(screen.getByText("test_flag_2")).toBeInTheDocument();
    expect(screen.getByText("test_flag_3")).toBeInTheDocument();
    expect(screen.queryByText("manage_flags")).not.toBeInTheDocument();

    const rows = screen.getAllByRole("row");
    const activeRow = rows.find((row) =>
      row.textContent?.includes("test_flag_1"),
    );
    const inactiveRow = rows.find((row) =>
      row.textContent?.includes("test_flag_2"),
    );
    const nonGlobalRow = rows.find((row) =>
      row.textContent?.includes("test_flag_3"),
    );

    expect(activeRow?.className).toContain("is-active");
    expect(inactiveRow?.className).toContain("is-inactive");
    expect(nonGlobalRow?.className).toContain("is-non-global");

    const { flagInput, actionInput, submitButton } = getFormInputs();
    expect(flagInput).toBeInTheDocument();
    expect(actionInput).toBeInTheDocument();
    expect(submitButton).toBeInTheDocument();
    expect(flagInput.placeholder).toContain("test_flag_1");

    await user.type(flagInput, "new_flag");
    expect(flagInput.value).toBe("new_flag");
    await user.type(actionInput, "enable");
    expect(actionInput.value).toBe("enable");

    cleanup();
    mockedUseApiV1.mockReturnValue({
      data: [{ id: 1, name: "manage_flags", everyone: true, note: "" }],
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
    });
    render(<Flags />);
    expect(screen.queryAllByRole("row").length).toBe(1);
    expect(screen.queryByText("manage_flags")).not.toBeInTheDocument();
  });

  it("enables, disables flags, handles API calls, form clearing, and errors", async () => {
    const mutateMock = jest.fn();
    mockedUseApiV1.mockReturnValue({
      data: mockFlagData,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: mutateMock,
    });

    render(<Flags />);

    await fillAndSubmitForm("new_flag", "enable");
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/flags/", {
        method: "POST",
        body: JSON.stringify({ name: "new_flag", everyone: true }),
      });
    });
    expect(mutateMock).toHaveBeenCalled();
    expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
      type: "success",
    });

    jest.clearAllMocks();
    await fillAndSubmitForm("test_flag_2", "enable");
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/flags/3/", {
        method: "PATCH",
        body: JSON.stringify({ everyone: true }),
      });
    });

    jest.clearAllMocks();
    await fillAndSubmitForm("new_flag", "disable");
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/flags/", {
        method: "POST",
        body: JSON.stringify({ name: "new_flag", everyone: false }),
      });
    });

    jest.clearAllMocks();
    await fillAndSubmitForm("test_flag_1", "disable");
    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith("/flags/2/", {
        method: "PATCH",
        body: JSON.stringify({ everyone: false }),
      });
    });

    jest.clearAllMocks();
    await fillAndSubmitForm("test_flag_1", "enable");
    await waitFor(() => expectEmptyForm());

    jest.clearAllMocks();
    await fillAndSubmitForm("test_flag_3", "enable");
    await waitFor(() => {
      expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
        type: "error",
      });
    });
    expect(mockedApiFetch).not.toHaveBeenCalled();
    expect(mockedToast.mock.calls[0][0]).toBeDefined();

    jest.clearAllMocks();
    mockedApiFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    } as Response);

    await fillAndSubmitForm("test_flag_1", "enable");
    await waitFor(() => {
      expect(mockedToast).toHaveBeenCalledWith(expect.anything(), {
        type: "error",
      });
    });
    const { flagInput, actionInput } = getFormInputs();
    expect(flagInput.value).toBe("test_flag_1");
    expect(actionInput.value).toBe("enable");

    jest.clearAllMocks();
    await fillAndSubmitForm("test_flag_1", "invalid");
    await waitFor(() => {
      expect(mockedApiFetch).not.toHaveBeenCalled();
    });
  });
});
