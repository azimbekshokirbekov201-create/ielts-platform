"use client";
import { SystemMessage } from "@/components/system-message";
export default function Error({ reset }: { reset: () => void }) {
  return <SystemMessage code="server_error" reset={reset} />;
}
