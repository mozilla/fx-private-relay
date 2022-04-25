// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { OutboundLink } = jest.requireActual("react-ga") as any;

export const mockReactGa = {
  event: jest.fn(),
  OutboundLink: OutboundLink,
};
