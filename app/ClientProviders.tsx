"use client";
import { ReactNode } from "react";
import { RootProvider } from "./rootProvider";

export function ClientProviders({ children }: { children: ReactNode }) {
  return <RootProvider>{children}</RootProvider>;
}

