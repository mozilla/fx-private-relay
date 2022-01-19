export const mockCookiesModule = {
  getCookie: jest.fn((_key: string) => undefined),
  setCookie: jest.fn((_key: string, _value: string) => {
    return;
  }),
  clearCookie: jest.fn((_key: string) => {
    return;
  }),
};
