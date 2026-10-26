// Native modules without a JS implementation in Jest.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('react-native-reanimated', () => jest.requireActual('./mocks/reanimated'));

// Reanimated reads the reduced-motion media query.
const g = globalThis as unknown as { window?: { matchMedia?: unknown } };
if (g.window && !g.window.matchMedia) {
  g.window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  });
}
