"use client";

import { useEffect } from "react";

function safeParse<T = unknown>(raw: string | null): T | null {
  if (!raw || raw.trim().length === 0) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

type ReceiptDiagnosticsProps = {
  txParam: string;
};

export default function ReceiptDiagnostics({ txParam }: ReceiptDiagnosticsProps) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("st_receipts");
    const parsed = safeParse<unknown[]>(stored);
    console.debug("[Receipt] tx param:", txParam);
    console.debug("[Receipt] localStorage.st_receipts length:", stored?.length ?? 0);
    console.debug("[Receipt] parsed entries:", parsed?.length ?? 0);
  }, [txParam]);

  return null;
}
