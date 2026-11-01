"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function useReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
