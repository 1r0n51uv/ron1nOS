// Login degli e2e (docs/specs/auth.md): il backend sotto test ha il login
// acceso con questa password. Il progetto setup entra una volta e salva il
// cookie in STATE, che tutti gli altri test riusano.
export const E2E_PASSWORD = 'password-degli-e2e'
// npm run auth:hash con E2E_PASSWORD.
export const E2E_PASSWORD_HASH =
  'scrypt$32768$8$1$nOpClNLI39/soXVOvyYAwA==$dcuqRX1iN2NFOkbMuRCKHb/skk5EJ/RA3gEXCpsPCiw='
export const STATE = 'test-results/.auth/state.json'
