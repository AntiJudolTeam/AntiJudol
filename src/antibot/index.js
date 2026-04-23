import { fetchViaImpersonate } from "./impersonate.js";

export async function fetchViaAntibot(url, options = {}) {
  return fetchViaImpersonate(url, options);
}
