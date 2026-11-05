// Builds the "?a=1&b=2" part of a payment-service URL.
// Undefined/null/empty values are skipped so they never reach the URL as "undefined".
export const buildQueryString = (query?: object): string => {
  if (!query) return "";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.append(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
};
