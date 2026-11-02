"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markThreadReadAction } from "@/lib/actions";

export default function ThreadReadMarker({ lostReportId }: { lostReportId: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    markThreadReadAction(lostReportId)
      .then(() => {
        if (!cancelled) router.refresh();
      })
      .catch(() => {
        /* read receipts are best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [lostReportId, router]);

  return null;
}
