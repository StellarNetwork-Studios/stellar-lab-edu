/**
 * Backend origin for browser calls. Override in `.env.local`:
 * `NEXT_PUBLIC_StellarFoundry_API_URL=https://api.example.com`
 */
export const getStellarFoundryApiBase = (): string =>
  process.env.NEXT_PUBLIC_StellarFoundry_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000";
