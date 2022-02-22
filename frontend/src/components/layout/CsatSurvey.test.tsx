import { jest, describe, it, expect } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { mockCookiesModule } from "../../../__mocks__/functions/cookies";
import { mockGetLocaleModule } from "../../../__mocks__/functions/getLocale";
import { getMockProfileData } from "../../../__mocks__/hooks/api/profile";
import { mockFluentReact } from "../../../__mocks__/modules/fluent__react";

import { CsatSurvey } from "./CsatSurvey";

jest.mock("@fluent/react", () => mockFluentReact);
jest.mock("../../functions/cookies.ts", () => mockCookiesModule);
jest.mock("../../functions/getLocale.ts", () => mockGetLocaleModule);
jest.mock("../../hooks/firstSeen.ts");

describe("The CSAT survey", () => {
  it("does not display the survey if the user has joined within the last week", () => {
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-7days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days") ? Date.now() : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1001)
    );
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days")
        ? Date.now() - 3 * 30 * 24 * 60 * 60 * 1001
        : undefined
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    const getCookie: jest.Mock =
      // TypeScript can't follow paths in `jest.requireMock`:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
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
        Date.now() - 7 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
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
        Date.now() - 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-30days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-30days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
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
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-30days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-7days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("free-90days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-90days") ? Date.now() : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 3 * 30 * 24 * 60 * 60 * 1000
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
      (jest.requireMock("../../functions/cookies.ts") as any).getCookie;
    getCookie.mockImplementation((key: string) =>
      key.includes("premium-90days")
        ? Date.now() - 3 * 30 * 24 * 60 * 60 * 1001
        : undefined
    );
    const mockProfileData = getMockProfileData({
      has_premium: true,
      date_subscribed: new Date(
        Date.now() - 6 * 30 * 24 * 60 * 60 * 1001
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLocale = (jest.requireMock("../../functions/getLocale.ts") as any)
      .getLocale;
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
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useFirstSeen = (jest.requireMock("../../hooks/firstSeen.ts") as any)
      .useFirstSeen;
    useFirstSeen.mockReturnValueOnce(new Date(0));
    // TypeScript can't follow paths in `jest.requireMock`:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getLocale = (jest.requireMock("../../functions/getLocale.ts") as any)
      .getLocale;
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
});
