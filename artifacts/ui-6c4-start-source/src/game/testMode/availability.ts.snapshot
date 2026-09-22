export interface TestModeEnvironment {
  DEV?: boolean;
  VITE_ENABLE_TEST_MODE?: string | boolean;
}

export function isTestModeEnabled(environment: TestModeEnvironment): boolean {
  return environment.DEV === true || environment.VITE_ENABLE_TEST_MODE === true || environment.VITE_ENABLE_TEST_MODE === 'true';
}

export function isTestModeRequested(environment: TestModeEnvironment, search: string): boolean {
  if (!isTestModeEnabled(environment)) return false;
  return new URLSearchParams(search).get('testMode') === '1';
}

export function currentTestModeAvailability(): { enabled: boolean; requested: boolean } {
  const environment = import.meta.env as TestModeEnvironment;
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return {
    enabled: isTestModeEnabled(environment),
    requested: isTestModeRequested(environment, search),
  };
}
