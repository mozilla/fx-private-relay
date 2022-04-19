export const mockUseFxaFlowTrackerModule = {
  useFxaFlowTracker: jest.fn(() => {
    // Tracker data can be undefined while runtime data is still loading:
    return {};
  }),
};
