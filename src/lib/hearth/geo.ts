import type { CircleEvent, Member, Place } from "@/lib/hearth/types";

const EARTH = 6_371_000;

export function haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const φ1 = (aLat * Math.PI) / 180;
  const φ2 = (bLat * Math.PI) / 180;
  const Δφ = ((bLat - aLat) * Math.PI) / 180;
  const Δλ = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function locate(
  lat: number,
  lng: number,
  places: Place[],
  prevId: string | null,
): string | null {
  const prev = prevId ? places.find((p) => p.id === prevId) : undefined;
  if (prev && haversine(lat, lng, prev.lat, prev.lng) <= prev.radius * 1.15) return prev.id;
  let best: Place | null = null;
  let bestD = Infinity;
  for (const place of places) {
    const d = haversine(lat, lng, place.lat, place.lng);
    if (d <= place.radius && d < bestD) {
      best = place;
      bestD = d;
    }
  }
  return best?.id ?? null;
}

export function formatDistance(meters: number): string {
  if (meters < 35) return "Here";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatMotion(mps: number): string {
  const kmh = mps * 3.6;
  if (kmh < 1) return "Still";
  if (kmh < 8) return `Walking · ${Math.round(kmh)} km/h`;
  return `On the way · ${Math.round(kmh)} km/h`;
}

export function formatUpdated(ts: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 15) return "Just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function formatClock(ts: number): string {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(ts);
}

export function whereLine(member: Member, places: Place[]): string {
  const place = places.find((p) => p.id === member.placeId);
  if (place) return `At ${place.name}`;
  let best: { name: string; d: number } | null = null;
  for (const p of places) {
    const d = haversine(member.lat, member.lng, p.lat, p.lng);
    if (!best || d < best.d) best = { name: p.name, d };
  }
  if (best && best.d < 900) return `${formatDistance(best.d)} from ${best.name}`;
  return "Away from saved places";
}

export function statusLine(member: Member, places: Place[], now = Date.now()): string {
  if (!member.sharing) return `Paused · ${formatUpdated(member.updatedAt, now)}`;
  return `${whereLine(member, places)} · ${formatMotion(member.speed)}`;
}

export function describeEvent(event: CircleEvent, members: Member[], places: Place[]): string {
  const name = members.find((m) => m.id === event.memberId)?.name ?? event.note ?? "Someone";
  const place =
    event.placeName ?? (event.placeId ? places.find((p) => p.id === event.placeId)?.name : undefined);
  switch (event.kind) {
    case "arrive":
      return place ? `${name} arrived at ${place}` : `${name} arrived`;
    case "leave":
      return place ? `${name} left ${place}` : `${name} left a saved place`;
    case "checkin":
      return event.note ? `${name} checked in — ${event.note}` : `${name} checked in`;
    case "ask":
      return `Check-in sent to ${name}`;
    case "ping":
      return `${name} pinged the circle`;
    case "pause":
      return `${name} paused sharing`;
    case "resume":
      return `${name} is sharing again`;
    case "joined":
      return `${name} joined the circle`;
    case "left":
      return `${event.note ?? name} left the circle`;
  }
}

export function makeInitials(name: string): string {
  const clean = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "\u0026amp;")
    .replaceAll("<", "\u0026lt;")
    .replaceAll(">", "\u0026gt;")
    .replaceAll('"', "\u0026quot;")
    .replaceAll("'", "\u0026#39;");
}

let seq = 0;

export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}
