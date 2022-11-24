export const mockCookiesModule = {
  getCookie: jest.fn<string | undefined, [string]>((_key) => undefined),
  setCookie: jest.fn((_key: string, _value: string) => {
    return;
  }),
  clearCookie: jest.fn((_key: string) => {
    return;
  }),
};
