// Any fixed origin works: values are parsed against it only to see whether they would leave the site.
const BASE = "http://localhost";

const staysOnSite = (value: string) => {
  try {
    return new URL(value, BASE).origin === BASE;
  } catch {
    return false;
  }
};

// Accepts only same-site paths like "/orders?page=2", so a crafted ?next= link can't send a user to another
// site after login (open redirect). Values are parsed the way a browser parses them: browsers drop tabs and
// newlines inside URLs, treat "\" like "/" and collapse "." and ".." segments, so "/\t/evil.com",
// "/\evil.com" or "/.//evil.com" would all end up at "//evil.com". The normalized path is checked once more,
// so only a value that still points at this site is returned.
export function safeRedirectPath(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.startsWith("/") || !staysOnSite(value)) return fallback;

  const url = new URL(value, BASE);
  const path = `${url.pathname}${url.search}${url.hash}`;
  return staysOnSite(path) ? path : fallback;
}
