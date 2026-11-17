import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/hearth/AppShell";
import { useHearth } from "@/lib/hearth/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  useEffect(() => {
    if (!useHearth.persist.hasHydrated()) void useHearth.persist.rehydrate();
  }, []);

  return <AppShell />;
}
