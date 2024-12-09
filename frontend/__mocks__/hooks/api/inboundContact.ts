import {
  InboundContact,
  useInboundContact,
} from "../../../src/hooks/api/inboundContact";
import { UpdateForwardingToPhone } from "../../../src/hooks/api/relayNumber";

jest.mock("../../../src/hooks/api/inboundContact");

// We know that `jest.mock` has turned exported functions into mock functions,
// but TypeScript can't — so we tell it using a type assertion:
const mockedUseInboundContact = useInboundContact as jest.MockedFunction<
  typeof useInboundContact
>;

export function getMockInboundContact(
  inboundContact: Partial<InboundContact> | undefined,
): InboundContact {
  return {
    id: 0,
    relay_number: 150,
    inbound_number: "+18089251571",
    last_inbound_date: "2022-07-27T10:18:01.801Z",
    last_inbound_type: "call",
    num_calls: 45,
    num_calls_blocked: 3,
    last_call_date: "2024-12-09T10:18:01.801Z",
    num_texts: 13,
    num_texts_blocked: 18,
    last_text_date: "2024-12-09T01:18:01.801Z",
    blocked: false,
    ...inboundContact,
  };
}

type Callbacks = {
  setForwardingState: UpdateForwardingToPhone;
};

function getReturnValue(
  inboundContacts: Array<Partial<InboundContact>> = [
    getMockInboundContact(undefined),
  ],
  callbacks?: Callbacks,
): ReturnType<typeof useInboundContact> {
  return {
    isValidating: false,
    mutate: jest.fn(),
    data: inboundContacts.map((partialInboundContact) =>
      getMockInboundContact(partialInboundContact),
    ),
    setForwardingState:
      callbacks?.setForwardingState ??
      jest.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
    error: undefined,
    isLoading: false,
  };
}

export const setMockInboundContactData = (
  inboundContacts?: Array<Partial<InboundContact>>,
  callbacks?: Callbacks,
) => {
  mockedUseInboundContact.mockReturnValue(
    getReturnValue(inboundContacts, callbacks),
  );
};

export const setMockRelayNumberDataOnce = (
  inboundContacts?: Array<Partial<InboundContact>>,
  callbacks?: Callbacks,
) => {
  mockedUseInboundContact.mockReturnValueOnce(
    getReturnValue(inboundContacts, callbacks),
  );
};
