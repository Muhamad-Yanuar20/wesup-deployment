"use client";

import { useEffect, useState } from "react";
import { calculatePaymentCountdown, type PaymentCountdownResult } from "@/lib/payments/countdown";

export function usePaymentWindowCountdown(serverTime: string | null, deadline: string | null): PaymentCountdownResult {
  const [now, setNow] = useState(() => Date.now());
  const [clientSyncMs] = useState(() => Date.now());

  useEffect(() => {
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { window.clearTimeout(first); window.clearInterval(timer); };
  }, [serverTime, deadline]);

  return calculatePaymentCountdown(serverTime, deadline, now, clientSyncMs);
}