import { useEffect, useState } from "react";
import { CirclePanel } from "@/components/hearth/CirclePanel";
import { MapCanvas } from "@/components/hearth/MapCanvas";
import { ME } from "@/lib/hearth/types";
import { useHearth } from "@/lib/hearth/store";

export function AppShell() {
  const wantGps = useHearth((s) => s.wantGps);
  const setMyFix = useHearth((s) => s.setMyFix);
  const setGpsError = useHearth((s) => s.setGpsError);

  useEffect(() => {
    const id = window.setInterval(() => useHearth.getState().tick(), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!wantGps) return;
    if (!navigator.geolocation) {
      setGpsError("This browser has no location.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        setMyFix(pos.coords.latitude, pos.coords.longitude, pos.coords.speed);
      },
      () => setGpsError("Location stayed off. You can still drop yourself on the map."),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [wantGps, setMyFix, setGpsError]);

  return (
    <div className="hearth-app text-paper">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />
        <div className="relative min-h-[12rem] flex-1">
          <MapCanvas />
        </div>
      </div>
      <section className="hearth-sheet" aria-label="Circle">
        <CirclePanel />
      </section>
    </div>
  );
}

function Header() {
  const circleName = useHearth((s) => s.circleName);
  const renameCircle = useHearth((s) => s.renameCircle);
  const sharing = useHearth((s) => s.members.find((m) => m.id === ME)?.sharing ?? false);
  const toggleMySharing = useHearth((s) => s.toggleMySharing);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(circleName);

  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-copper" aria-hidden />
          <h1 className="font-display text-2xl leading-none font-semibold">Hearth</h1>
        </div>
        {editing ? (
          <input
            autoFocus
            value={draft}
            maxLength={32}
            aria-label="Circle name"
            className="mt-1 w-full rounded-lg border border-line bg-ink px-2 py-2 text-base text-paper outline-none"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const next = draft.trim();
              if (next) renameCircle(next);
              else setDraft(circleName);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setDraft(circleName);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(circleName);
              setEditing(true);
            }}
            className="mt-1 max-w-full truncate text-left text-sm text-clay"
          >
            {circleName}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-pressed={sharing}
        onClick={toggleMySharing}
        className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${sharing ? "bg-copper text-copper-ink" : "border border-line text-clay"}`}
      >
        {sharing ? "Sharing" : "Paused"}
      </button>
    </header>
  );
}
