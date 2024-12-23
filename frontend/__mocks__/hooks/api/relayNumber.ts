import {
  PhoneNumberRegisterRelayNumberFn,
  RelayNumber,
  UpdateForwardingToPhone,
  useRelayNumber,
} from "../../../src/hooks/api/relayNumber";

jest.mock("../../../src/hooks/api/relayNumber");

// We know that `jest.mock` has turned exported functions into mock functions,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseRelayNumber = useRelayNumber as jest.MockedFunction<
  typeof useRelayNumber
>;

export function getMockRelayNumber(
  relayNumber?: Partial<RelayNumber>,
): RelayNumber {
  return {
    id: 1,
    location: "Hilo",
    number: "+18089251571",
    country_code: "US",
    enabled: true,
    remaining_texts: 50,
    remaining_minutes: 60,
    calls_forwarded: 5,
    calls_blocked: 2,
    texts_forwarded: 10,
    texts_blocked: 3,
    calls_and_texts_forwarded: 15,
    calls_and_texts_blocked: 5,
    ...relayNumber,
  };
}

type Callbacks = {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
  setForwardingState: UpdateForwardingToPhone;
};

function getReturnValue(
  relayNumbers: Array<Partial<RelayNumber>> = [getMockRelayNumber()],
  callbacks?: Callbacks,
): ReturnType<typeof useRelayNumber> {
  return {
    isValidating: false,
    isLoading: false,
    error: undefined,
    mutate: jest.fn(),
    data: relayNumbers.map((partialRelayNumber) =>
      getMockRelayNumber(partialRelayNumber),
    ),
    registerRelayNumber:
      callbacks?.registerRelayNumber ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
    setForwardingState:
      callbacks?.setForwardingState ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  };
}

export const setMockRelayNumberData = (
  relayNumbers?: Array<Partial<RelayNumber>>,
  callbacks?: Callbacks,
) => {
  mockedUseRelayNumber.mockReturnValue(getReturnValue(relayNumbers, callbacks));
};

export const setMockRelayNumberDataOnce = (
  relayNumbers?: Array<Partial<RelayNumber>>,
  callbacks?: Callbacks,
) => {
  mockedUseRelayNumber.mockReturnValueOnce(
    getReturnValue(relayNumbers, callbacks),
  );
};
