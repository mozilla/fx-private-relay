import {
  VerifiedPhone,
  UnverifiedPhone,
  RealPhone,
  useRealPhonesData,
  PhoneNumberRequestVerificationFn,
  PhoneNumberSubmitVerificationFn,
} from "../../../src/hooks/api/realPhone";

jest.mock("../../../src/hooks/api/realPhone");

// We know that `jest.mock` has turned exported functions into mock functions,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseRealPhonesData = useRealPhonesData as jest.MockedFunction<
  typeof useRealPhonesData
>;

export function getMockVerifiedRealPhone(
  realPhone?: Partial<VerifiedPhone>
): VerifiedPhone {
  return {
    id: 0,
    number: "+14155552671",
    verification_code: "123456",
    verification_sent_date: "2022-07-27T10:17:29.775Z",
    verified: true,
    verified_date: "2022-07-27T10:18:01.801Z",
    ...realPhone,
  };
}

export function getMockVerificationPendingRealPhone(
  realPhone?: Partial<UnverifiedPhone>
): UnverifiedPhone {
  return {
    id: 0,
    number: "+14155552671",
    verification_code: "123456",
    verification_sent_date: new Date().toISOString(),
    verified: false,
    verified_date: null,
    ...realPhone,
  };
}

export function getMockUnverifiedRealPhone(
  realPhone?: Partial<UnverifiedPhone>
): UnverifiedPhone {
  return {
    id: 0,
    number: "+14155552671",
    verification_code: "123456",
    verification_sent_date: "2022-07-27T10:17:29.775Z",
    verified: false,
    verified_date: null,
    ...realPhone,
  };
}

export function getMockRealPhone(
  realPhone?: Partial<RealPhone>
): UnverifiedPhone {
  return getMockUnverifiedRealPhone(realPhone as Partial<UnverifiedPhone>);
}

type Callbacks = {
  requestPhoneVerification: PhoneNumberRequestVerificationFn;
  submitPhoneVerification: PhoneNumberSubmitVerificationFn;
};

function getReturnValue(
  realPhones: Array<Partial<RealPhone>> = [getMockRealPhone()],
  callbacks?: Callbacks
): ReturnType<typeof useRealPhonesData> {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: realPhones.map((partialRealPhone) =>
      getMockRealPhone(partialRealPhone)
    ),
    requestPhoneVerification:
      callbacks?.requestPhoneVerification ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
    submitPhoneVerification:
      callbacks?.submitPhoneVerification ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  };
}

export const setMockRealPhonesData = (
  realPhones?: Array<Partial<RealPhone>>,
  callbacks?: Callbacks
) => {
  mockedUseRealPhonesData.mockReturnValue(
    getReturnValue(realPhones, callbacks)
  );
};

export const setMockRealPhonesDataOnce = (
  realPhones?: Array<Partial<RealPhone>>,
  callbacks?: Callbacks
) => {
  mockedUseRealPhonesData.mockReturnValueOnce(
    getReturnValue(realPhones, callbacks)
  );
};
