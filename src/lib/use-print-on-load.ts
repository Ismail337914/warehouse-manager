"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

// Print pages opened with ?print=1 (the "Štampaj" buttons at the till and on documents) open the browser's
// print dialog by themselves once the document is on screen, so printing takes one click. Only once per visit.
export function usePrintOnLoad(ready: boolean) {
  const autoPrint = useSearchParams().get("print") === "1";
  const printed = useRef(false);

  useEffect(() => {
    if (!autoPrint || !ready || printed.current) return;
    // Let the browser paint the document before the dialog freezes the page. The flag is set inside the
    // callback, so a cancelled frame (effect cleanup, e.g. Strict Mode in development) still prints next time.
    const frame = requestAnimationFrame(() => {
      printed.current = true;
      window.print();
    });
    return () => cancelAnimationFrame(frame);
  }, [autoPrint, ready]);
}
