export const mockUseGoogleAnalyticsModule = {
  useGoogleAnalytics: jest.fn(),
  initGoogleAnalytics: jest.fn(),
};
mockUseGoogleAnalyticsModule.useGoogleAnalytics.mockReturnValue(true);
