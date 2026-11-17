import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LayerGroup, Map as LeafletMap, Marker } from "leaflet";
import { LocateFixed, Minus, Plus, Users } from "lucide-react";
import { escapeHtml } from "@/lib/hearth/geo";
import { registerCenter } from "@/lib/hearth/map-bridge";
import { HOME } from "@/lib/hearth/seed";
import { useHearth } from "@/lib/hearth/store";
import "leaflet/dist/leaflet.css";

type LeafletNS = typeof import("leaflet");

async function loadLeaflet(): Promise<LeafletNS> {
  const mod = (await import("leaflet")) as LeafletNS & { default?: LeafletNS };
  return typeof mod.map === "function" ? mod : (mod.default ?? mod);
}

function copperColor(): string {
  if (typeof document === "undefined") return "rgb(224, 138, 69)";
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-copper").trim();
  return value || "rgb(224, 138, 69)";
}

export function MapCanvas() {
  const holderRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const decorRef = useRef<LayerGroup | null>(null);
  const markerRef = useRef(new Map<string, { marker: Marker; sig: string }>());
  const leafletRef = useRef<LeafletNS | null>(null);
  const [ready, setReady] = useState(false);

  const members = useHearth((s) => s.members);
  const places = useHearth((s) => s.places);
  const selectedId = useHearth((s) => s.selectedId);
  const dropping = useHearth((s) => s.dropping);
  const fitNonce = useHearth((s) => s.fitNonce);
  const locateNonce = useHearth((s) => s.locateNonce);
  const select = useHearth((s) => s.select);
  const fit = useHearth((s) => s.fit);
  const locateMe = useHearth((s) => s.locateMe);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;
    let release = () => {};

    void (async () => {
      const L = await loadLeaflet();
      if (cancelled || !holderRef.current) return;
      map = L.map(holderRef.current, { zoomControl: false, attributionControl: true }).setView(
        [HOME.lat, HOME.lng],
        14,
      );
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
        detectRetina: true,
      }).addTo(map);
      map.attributionControl.setPosition("bottomleft");
      decorRef.current = L.layerGroup().addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      release = registerCenter(() => {
        const center = map?.getCenter();
        return center ? { lat: center.lat, lng: center.lng } : { ...HOME };
      });
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(holderRef.current);
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      release();
      observer?.disconnect();
      markerRef.current.forEach((entry) => entry.marker.remove());
      markerRef.current.clear();
      map?.remove();
      mapRef.current = null;
      decorRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const decor = decorRef.current;
    if (!ready || !L || !map || !decor) return;
    const ink = copperColor();
    decor.clearLayers();

    for (const place of places) {
      L.circle([place.lat, place.lng], {
        radius: place.radius,
        color: ink,
        weight: 1,
        opacity: 0.9,
        fillColor: ink,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(decor);
      L.marker([place.lat, place.lng], {
        interactive: false,
        icon: L.divIcon({
          className: "pin-wrap",
          html: `<div class="place-tag">${escapeHtml(place.name)}</div>`,
          iconSize: [1, 1],
          iconAnchor: [0, 0],
        }),
      }).addTo(decor);
    }

    const selected = members.find((m) => m.id === selectedId);
    if (selected && selected.trail.length > 1) {
      L.polyline(
        selected.trail.map((point) => [point.lat, point.lng] as [number, number]),
        { color: ink, weight: 3, opacity: 0.8, interactive: false },
      ).addTo(decor);
    }

    const seen = new Set<string>();
    for (const member of members) {
      seen.add(member.id);
      const live = member.sharing && member.speed > 0.8;
      const sig = `${member.initials}|${member.sharing ? 1 : 0}|${member.id === selectedId ? 1 : 0}|${live ? 1 : 0}`;
      const existing = markerRef.current.get(member.id);
      if (existing && existing.sig === sig) {
        existing.marker.setLatLng([member.lat, member.lng]);
        continue;
      }
      existing?.marker.remove();
      const marker = L.marker([member.lat, member.lng], {
        icon: L.divIcon({
          className: "pin-wrap",
          html: `<div class="pin${member.id === selectedId ? " is-on" : ""}${member.sharing ? "" : " is-paused"}${live ? " is-live" : ""}"><span>${escapeHtml(member.initials)}</span></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }),
        zIndexOffset: member.id === selectedId ? 800 : live ? 400 : 0,
        title: member.name,
        keyboard: false,
      }).addTo(map);
      marker.on("click", () => select(member.id));
      markerRef.current.set(member.id, { marker, sig });
    }
    for (const [id, entry] of markerRef.current) {
      if (!seen.has(id)) {
        entry.marker.remove();
        markerRef.current.delete(id);
      }
    }
  }, [members, places, selectedId, ready, select]);

  useEffect(() => {
    if (!ready) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const people = useHearth.getState().members;
    if (!L || !map || people.length === 0) return;
    const bounds = L.latLngBounds(people.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.35), { animate: false });
  }, [ready]);

  useEffect(() => {
    if (!ready || fitNonce === 0) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const people = useHearth.getState().members;
    if (!L || !map || people.length === 0) return;
    const bounds = L.latLngBounds(people.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds.pad(0.35), { animate: true, duration: 0.55 });
  }, [fitNonce, ready]);

  useEffect(() => {
    if (!ready || !selectedId) return;
    const map = mapRef.current;
    const member = useHearth.getState().members.find((m) => m.id === selectedId);
    if (!map || !member) return;
    map.flyTo([member.lat, member.lng], Math.max(map.getZoom(), 16), { duration: 0.45 });
  }, [selectedId, ready]);

  useEffect(() => {
    if (!ready || locateNonce === 0) return;
    const map = mapRef.current;
    const member = useHearth.getState().members.find((m) => m.id === "me");
    if (!map || !member) return;
    map.flyTo([member.lat, member.lng], 16, { duration: 0.45 });
  }, [locateNonce, ready]);

  return (
    <div className="relative h-full min-h-0 w-full">
      <div ref={holderRef} className="h-full w-full" role="application" aria-label="Family map" />
      {dropping ? (
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="relative size-10">
            <span className="absolute top-0 left-1/2 h-full w-px -translate-x-1/2 bg-copper" />
            <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-copper" />
          </div>
        </div>
      ) : null}
      <div className="absolute top-3 right-3 z-[500] flex flex-col gap-2">
        <MapButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="size-5" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="size-5" />
        </MapButton>
      </div>
      <div className="absolute right-3 bottom-3 z-[500] flex flex-col gap-2">
        <MapButton label="Show everyone" onClick={fit}>
          <Users className="size-5" />
        </MapButton>
        <MapButton label="Find me" onClick={locateMe}>
          <LocateFixed className="size-5" />
        </MapButton>
      </div>
    </div>
  );
}

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-11 items-center justify-center rounded-full border border-line bg-panel text-paper"
    >
      {children}
    </button>
  );
}
