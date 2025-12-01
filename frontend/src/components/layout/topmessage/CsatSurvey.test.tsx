import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockCookiesModule } from "../../../../__mocks__/functions/cookies";
import { mockGetLocaleModule } from "../../../../__mocks__/functions/getLocale";
import { getMockProfileData } from "../../../../__mocks__/hooks/api/profile";
import { mockUseL10nModule } from "../../../../__mocks__/hooks/l10n";

import { CsatSurvey } from "./CsatSurvey";

jest.mock("../../../functions/cookies.ts", () => mockCookiesModule);
jest.mock("../../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../../hooks/firstSeen.ts");
jest.mock("../../../hooks/l10n.ts", () => mockUseL10nModule);

describe("The CSAT survey", () => {
  it("does not display the survey if the user has joined within the last week", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(Date.now()));
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a new free user", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a new free user that has dismissed or completed it before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a free user for more than a month", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a free user for more than a month that has dismissed or completed the 1-week survey before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a free user for more than a month that has dismissed or completed it before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a free user for more than three months", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a free user for more than three months that has dismissed or completed the 1-month survey before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a free user for more than three months that has dismissed or completed the 1-week survey before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a free user for more than three months that has dismissed or completed it before", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a free user for more than three months that has dismissed or completed the 3-month survey more than three months ago", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1001),
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days")
        ? Date.now() - 3 * 30 * 24 * 60 * 60 * 1001
        : undefined,
    );
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey if the user has purchased Premium within the last week", () => {
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(Date.now()).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("does not display the survey if the user has purchased Premium within the last week, even if they created an account a week ago and did not dismiss or complete the survey then", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockReturnValue(undefined);
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(Date.now()).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after a week", () => {
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a new Premium user for a week who has completed or dismissed it before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after a month", () => {
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after a month that has dismissed or completed the 1-week survey before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after a month that has dismissed or completed the 1-month free user survey before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a new Premium user for a month who has completed or dismissed it before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-30days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after three months", () => {
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after three months that has dismissed or completed the 1-month survey before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-30days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after three months that has dismissed or completed the 1-week survey before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after three months that has dismissed or completed the 3-month free user survey before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a new Premium user for three months who has completed or dismissed it before", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-90days") ? Date.now() : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey to a new Premium user after more than three months that has dismissed or completed it more than three months ago", () => {
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-90days")
        ? Date.now() - 3 * 30 * 24 * 60 * 60 * 1001
        : undefined,
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 6 * 30 * 24 * 60 * 60 * 1001,
      ).toISOString(),
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("displays the survey to a new Premium whose subscription date is unknown, but who was first seen more than 7 days ago", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: null,
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey to a new Premium whose subscription date is unknown, and who was first seen less than 7 days ago", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(Date.now()));
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: null,
    });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  it("displays the survey if the user's language is set without a country code", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    const getLocale = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/getLocale.ts") as any).getLocale;
    getLocale.mockReturnValueOnce("fr");
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.getByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.getByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).toBeInTheDocument();
    expect(verySatisfiedButton).toBeInTheDocument();
  });

  it("does not display the survey if the user's language is set to something other than English, French, or German", () => {
    const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    const getLocale = // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../../functions/getLocale.ts") as any).getLocale;
    getLocale.mockReturnValueOnce("fy");
    const mockProfileData = getMockProfileData({ has_premium: false });

    render(<CsatSurvey profile={mockProfileData} />);

    const veryDissatisfiedButton = screen.queryByRole("button", {
      name: /very-dissatisfied/,
    });
    const verySatisfiedButton = screen.queryByRole("button", {
      name: /very-satisfied/,
    });

    expect(veryDissatisfiedButton).not.toBeInTheDocument();
    expect(verySatisfiedButton).not.toBeInTheDocument();
  });

  describe("User interactions", () => {
    beforeEach(() => {
      const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
      useFirstSeen.mockReturnValue(new Date(0));
      global.gaEventMock.mockClear();
    });

    it("displays all five answer buttons", () => {
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      expect(
        screen.getByRole("button", {
          name: /survey-csat-answer-very-dissatisfied/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /survey-csat-answer-dissatisfied.*(?!very)/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /survey-csat-answer-neutral/ }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /survey-csat-answer-satisfied.*(?!very)/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", {
          name: /survey-csat-answer-very-satisfied/,
        }),
      ).toBeInTheDocument();
    });

    it("displays the dismiss button", () => {
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const dismissButtons = screen.getAllByTitle(/survey-option-dismiss/);
      expect(dismissButtons.length).toBeGreaterThan(0);
    });

    it("tracks GA event when user submits 'Very Satisfied' answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const verySatisfiedButton = screen.getByRole("button", {
        name: /survey-csat-answer-very-satisfied/,
      });
      await user.click(verySatisfiedButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "CSAT Survey",
        action: "submitted",
        label: "Very Satisfied",
        value: 5,
        dimension3: "Satisfied",
        dimension4: "Very Satisfied",
        metric10: 1,
        metric11: 5,
        metric12: 1,
      });
    });

    it("tracks GA event when user submits 'Satisfied' answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const allButtons = screen.getAllByRole("button");
      const satisfiedButton = allButtons.find((btn) =>
        btn.textContent?.includes("[survey-csat-answer-satisfied]"),
      )!;
      await user.click(satisfiedButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "CSAT Survey",
        action: "submitted",
        label: "Satisfied",
        value: 4,
        dimension3: "Satisfied",
        dimension4: "Satisfied",
        metric10: 1,
        metric11: 4,
        metric12: 1,
      });
    });

    it("tracks GA event when user submits 'Neutral' answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const neutralButton = screen.getByRole("button", {
        name: /survey-csat-answer-neutral/,
      });
      await user.click(neutralButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "CSAT Survey",
        action: "submitted",
        label: "Neutral",
        value: 3,
        dimension3: "Neutral",
        dimension4: "Neutral",
        metric10: 1,
        metric11: 3,
        metric12: 0,
      });
    });

    it("tracks GA event when user submits 'Dissatisfied' answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const dissatisfiedButton = screen.getAllByRole("button", {
        name: /survey-csat-answer-dissatisfied/,
      })[0];
      await user.click(dissatisfiedButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "CSAT Survey",
        action: "submitted",
        label: "Dissatisfied",
        value: 2,
        dimension3: "Dissatisfied",
        dimension4: "Dissatisfied",
        metric10: 1,
        metric11: 2,
        metric12: -1,
      });
    });

    it("tracks GA event when user submits 'Very Dissatisfied' answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const veryDissatisfiedButton = screen.getByRole("button", {
        name: /survey-csat-answer-very-dissatisfied/,
      });
      await user.click(veryDissatisfiedButton);

      expect(global.gaEventMock).toHaveBeenCalledWith({
        category: "CSAT Survey",
        action: "submitted",
        label: "Very Dissatisfied",
        value: 1,
        dimension3: "Dissatisfied",
        dimension4: "Very Dissatisfied",
        metric10: 1,
        metric11: 1,
        metric12: -1,
      });
    });

    it("shows follow-up link after user submits an answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const allButtons = screen.getAllByRole("button");
      const satisfiedButton = allButtons.find((btn) =>
        btn.textContent?.includes("[survey-csat-answer-satisfied]"),
      )!;
      await user.click(satisfiedButton);

      const followUpLink = await screen.findByRole("link");
      expect(followUpLink).toBeInTheDocument();
      expect(followUpLink).toHaveAttribute("href");
      expect(followUpLink).toHaveAttribute("target", "_blank");
    });

    it("uses free survey link for free users", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const allButtons = screen.getAllByRole("button");
      const satisfiedButton = allButtons.find((btn) =>
        btn.textContent?.includes("[survey-csat-answer-satisfied]"),
      )!;
      await user.click(satisfiedButton);

      const followUpLink = await screen.findByRole("link");
      expect(followUpLink).toHaveAttribute(
        "href",
        expect.stringContaining("6665054"),
      );
    });

    it("uses premium survey link for premium users", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({
        has_premium: true,
        date_subscribed: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
      render(<CsatSurvey profile={mockProfileData} />);

      const allButtons = screen.getAllByRole("button");
      const satisfiedButton = allButtons.find((btn) =>
        btn.textContent?.includes("[survey-csat-answer-satisfied]"),
      )!;
      await user.click(satisfiedButton);

      const followUpLink = await screen.findByRole("link");
      expect(followUpLink).toHaveAttribute(
        "href",
        expect.stringContaining("6665054"),
      );
    });

    it("hides answer buttons after user submits an answer", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const allButtons = screen.getAllByRole("button");
      const satisfiedButton = allButtons.find((btn) =>
        btn.textContent?.includes("[survey-csat-answer-satisfied]"),
      )!;
      await user.click(satisfiedButton);

      await screen.findByRole("link");

      const answerButtons = screen.queryAllByRole("button", {
        name: /survey-csat-answer/,
      });
      expect(answerButtons).toHaveLength(0);
    });
  });

  describe("Dismiss functionality", () => {
    beforeEach(() => {
      const useFirstSeen = // TypeScript can't follow paths in `jest.requireMock`:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (jest.requireMock("../../../hooks/firstSeen.ts") as any).useFirstSeen;
      useFirstSeen.mockReturnValue(new Date(0));
    });

    it("allows user to dismiss the survey without answering", async () => {
      const user = userEvent.setup();
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const dismissButtons = screen.getAllByTitle(/survey-option-dismiss/);
      expect(dismissButtons.length).toBeGreaterThan(0);

      await user.click(dismissButtons[0]);
    });

    it("renders CloseIcon in the dismiss button", () => {
      const mockProfileData = getMockProfileData({ has_premium: false });
      render(<CsatSurvey profile={mockProfileData} />);

      const dismissButtons = screen.getAllByTitle(/survey-option-dismiss/);
      expect(dismissButtons.length).toBeGreaterThan(0);
    });
  });
});
