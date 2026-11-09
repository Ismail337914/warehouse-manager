import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The only other origin the browser talks to: Supabase (REST and Auth; the app uses no Realtime, so no wss:).
const supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321").origin;

// Content-Security-Policy without nonces: nonces need fully dynamic rendering, which Partial Prerendering
// (cacheComponents) rules out (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// Inline scripts stay allowed for Next's own bootstrap, but scripts, connections, images and fonts may only come
// from this site and Supabase, so injected code can't load more code or send data anywhere else.
// 'unsafe-eval' only in development (React's dev error overlay). Upgrading http requests only on Vercel (https),
// so the production build served on http://localhost for the browser tests keeps working.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(process.env.VERCEL ? ["upgrade-insecure-requests"] : []),
].join("; ");

// Security headers on every response.
const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Camera only for this app itself (a future barcode scanner); microphone, location and payment never.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
