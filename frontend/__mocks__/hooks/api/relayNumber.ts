import {
  PhoneNumberRegisterRelayNumberFn,
  RelayNumber,
  useRelayNumber,
} from "../../../src/hooks/api/relayNumber";

jest.mock("../../../src/hooks/api/relayNumber");

// We know that `jest.mock` has turned exported functions into mock functions,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseRelayNumber = useRelayNumber as jest.MockedFunction<
  typeof useRelayNumber
>;

export function getMockRelayNumber(
  relayNumber?: Partial<RelayNumber>
): RelayNumber {
  return {
    location: "Hilo",
    number: "+18089251571",
    ...relayNumber,
  };
}

type Callbacks = {
  registerRelayNumber: PhoneNumberRegisterRelayNumberFn;
};

function getReturnValue(
  relayNumbers: Array<Partial<RelayNumber>> = [getMockRelayNumber()],
  callbacks?: Callbacks
): ReturnType<typeof useRelayNumber> {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: relayNumbers.map((partialRelayNumber) =>
      getMockRelayNumber(partialRelayNumber)
    ),
    registerRelayNumber:
      callbacks?.registerRelayNumber ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  };
}

export const setMockRelayNumberData = (
  relayNumbers?: Array<Partial<RelayNumber>>,
  callbacks?: Callbacks
) => {
  mockedUseRelayNumber.mockReturnValue(getReturnValue(relayNumbers, callbacks));
};

export const setMockRelayNumberDataOnce = (
  relayNumbers?: Array<Partial<RelayNumber>>,
  callbacks?: Callbacks
) => {
  mockedUseRelayNumber.mockReturnValueOnce(
    getReturnValue(relayNumbers, callbacks)
  );
};
