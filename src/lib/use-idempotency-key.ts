"use client";

import { useRef } from "react";

// One key per submission. A retry (double click, network error) reuses the same key, so the database books
// the operation once; after a success call renew() so the next submission gets a new key.
// The key is created on first use (in an event handler), never during render.
export function useIdempotencyKey() {
  const keyRef = useRef<string | null>(null);

  return {
    get: () => {
      keyRef.current ??= crypto.randomUUID();
      return keyRef.current;
    },
    renew: () => {
      keyRef.current = null;
    },
  };
}
