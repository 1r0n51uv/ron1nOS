// Login degli e2e (docs/specs/auth.md): il backend sotto test ha il login
// acceso con questo codice. Il progetto setup entra una volta e salva il
// cookie in STATE, che tutti gli altri test riusano.
export const E2E_PASSWORD = '4827'
// npm run auth:hash con E2E_PASSWORD.
export const E2E_PASSWORD_HASH =
  'scrypt$32768$8$1$2vUdoIRWeJa8u5kg0GCXiw==$de5b15Ux9taX5UFMYNwAFZBe1F4aDVQvLpiIfxmEjEo='
export const STATE = 'test-results/.auth/state.json'
