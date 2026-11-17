import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { locate, makeInitials, uid, haversine } from "@/lib/hearth/geo";
import { readCenter } from "@/lib/hearth/map-bridge";
import { createSeed, HOME } from "@/lib/hearth/seed";
import type {
  AddRole,
  CircleEvent,
  Member,
  Pending,
  Place,
  PlaceKind,
  Tab,
} from "@/lib/hearth/types";
import { ME } from "@/lib/hearth/types";

type Seed = ReturnType<typeof createSeed>;

export type HearthState = Seed & {
  pending: Pending[];
  introSeen: boolean;
  wantGps: boolean;
  pingLockedUntil: number;
  lastTick: number;
  tab: Tab;
  selectedId: string | null;
  dropping: boolean;
  fitNonce: number;
  locateNonce: number;
  gpsError: string | null;
  setTab: (tab: Tab) => void;
  select: (id: string | null) => void;
  dismissIntro: () => void;
  renameCircle: (name: string) => void;
  toggleMySharing: () => void;
  setWantGps: (on: boolean) => void;
  setGpsError: (message: string | null) => void;
  setMyFix: (lat: number, lng: number, speed: number | null) => void;
  dropMeAtCenter: () => void;
  renameMember: (id: string, patch: { name?: string; detail?: string }) => void;
  addMember: (input: { name: string; role: AddRole; detail: string }) => void;
  removeMember: (id: string) => void;
  setDropping: (on: boolean) => void;
  addPlace: (input: { name: string; kind: PlaceKind; radius: number }) => void;
  removePlace: (id: string) => void;
  askCheckIn: (memberId: string) => boolean;
  ping: () => boolean;
  fit: () => void;
  locateMe: () => void;
  tick: (now?: number) => void;
};

function event(
  kind: CircleEvent["kind"],
  memberId: string,
  at: number,
  extra?: Partial<CircleEvent>,
): CircleEvent {
  return { id: uid("ev"), kind, memberId, at, ...extra };
}

function placeName(places: Place[], id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return places.find((p) => p.id === id)?.name;
}

function pushPlaceChange(
  fresh: CircleEvent[],
  member: Member,
  nextPlace: string | null,
  places: Place[],
  at: number,
) {
  if (!member.sharing || nextPlace === member.placeId) return;
  if (nextPlace) {
    fresh.push(
      event("arrive", member.id, at, { placeId: nextPlace, placeName: placeName(places, nextPlace) }),
    );
  } else if (member.placeId) {
    fresh.push(
      event("leave", member.id, at, {
        placeId: member.placeId,
        placeName: placeName(places, member.placeId),
      }),
    );
  }
}

function movedTo(
  member: Member,
  lat: number,
  lng: number,
  speed: number,
  now: number,
  places: Place[],
  fresh: CircleEvent[],
  recordTrail: boolean,
): Member {
  const placeId = member.sharing ? locate(lat, lng, places, member.placeId) : member.placeId;
  pushPlaceChange(fresh, member, placeId, places, now);
  const moved = Math.hypot(lat - member.lat, lng - member.lng);
  const trail =
    recordTrail && moved > 0.00004
      ? [...member.trail, { lat, lng }].slice(-30)
      : member.trail;
  return {
    ...member,
    lat,
    lng,
    speed: member.sharing ? speed : 0,
    placeId,
    updatedAt: member.sharing ? now : member.updatedAt,
    trail,
  };
}

function advance(member: Member, dt: number, now: number, places: Place[], fresh: CircleEvent[]): Member {
  if (!member.sharing || member.hold || member.id === ME) {
    return movedTo(member, member.lat, member.lng, 0, now, places, fresh, false);
  }
  if (member.dwellUntil > now) {
    return movedTo(member, member.lat, member.lng, 0, now, places, fresh, false);
  }
  const target = member.route[member.routeIndex];
  if (!target) return movedTo(member, member.lat, member.lng, 0, now, places, fresh, false);

  const meters = haversine(member.lat, member.lng, target.lat, target.lng);
  const step = Math.max(0.4, member.mps * dt);
  if (meters <= Math.max(10, step)) {
    const next = movedTo(member, target.lat, target.lng, 0, now, places, fresh, true);
    const count = member.route.length || 1;
    return {
      ...next,
      routeIndex: (member.routeIndex + 1) % count,
      dwellUntil: target.pauseMs ? now + target.pauseMs : 0,
      speed: 0,
    };
  }
  const t = step / meters;
  return movedTo(
    member,
    member.lat + (target.lat - member.lat) * t,
    member.lng + (target.lng - member.lng) * t,
    member.mps,
    now,
    places,
    fresh,
    true,
  );
}

function loopAround(lat: number, lng: number): Member["route"] {
  const d = 0.00032;
  return [
    { lat, lng, pauseMs: 12_000 },
    { lat: lat + d, lng: lng + d * 0.7, pauseMs: 6_000 },
    { lat: lat - d * 0.4, lng: lng + d, pauseMs: 6_000 },
    { lat: lat - d * 0.5, lng: lng - d * 0.6, pauseMs: 6_000 },
  ];
}

const seed = createSeed();

export const useHearth = create<HearthState>()(
  persist(
    (set, get) => ({
      ...seed,
      pending: [],
      introSeen: false,
      wantGps: false,
      pingLockedUntil: 0,
      lastTick: 0,
      tab: "people",
      selectedId: null,
      dropping: false,
      fitNonce: 0,
      locateNonce: 0,
      gpsError: null,

      setTab: (tab) => set({ tab }),
      select: (id) => set({ selectedId: id, tab: id ? "people" : get().tab }),
      dismissIntro: () => set({ introSeen: true }),
      renameCircle: (name) => set({ circleName: name.slice(0, 32) }),

      toggleMySharing: () =>
        set((state) => {
          const me = state.members.find((m) => m.id === ME);
          if (!me) return state;
          const now = Date.now();
          const sharing = !me.sharing;
          return {
            members: state.members.map((m) =>
              m.id === ME ? { ...m, sharing, speed: sharing ? m.speed : 0 } : m,
            ),
            events: [event(sharing ? "resume" : "pause", ME, now), ...state.events].slice(0, 60),
          };
        }),

      setWantGps: (on) => set({ wantGps: on, gpsError: on ? null : get().gpsError }),
      setGpsError: (message) => set({ gpsError: message }),

      setMyFix: (lat, lng, speed) =>
        set((state) => {
          const me = state.members.find((m) => m.id === ME);
          if (!me || !me.sharing) return state;
          const now = Date.now();
          const fresh: CircleEvent[] = [];
          const prev = me;
          const dt = Math.max(1, (now - prev.updatedAt) / 1000);
          const meters = haversine(prev.lat, prev.lng, lat, lng);
          const derived = speed != null && speed >= 0 ? speed : meters / dt;
          const members = state.members.map((m) =>
            m.id === ME ? movedTo(m, lat, lng, derived, now, state.places, fresh, true) : m,
          );
          if (fresh.length === 0) return { members };
          return { members, events: [...fresh.reverse(), ...state.events].slice(0, 60) };
        }),

      dropMeAtCenter: () =>
        set((state) => {
          const center = readCenter();
          const now = Date.now();
          const me = state.members.find((m) => m.id === ME);
          if (!me) return state;
          const fresh: CircleEvent[] = [];
          if (!me.sharing) fresh.push(event("resume", ME, now));
          const members = state.members.map((m) =>
            m.id === ME
              ? movedTo({ ...m, sharing: true }, center.lat, center.lng, 0, now, state.places, fresh, true)
              : m,
          );
          return {
            members,
            selectedId: ME,
            tab: "people",
            gpsError: null,
            events: [...fresh.reverse(), ...state.events].slice(0, 60),
          };
        }),

      renameMember: (id, patch) =>
        set((state) => ({
          members: state.members.map((m) => {
            if (m.id !== id) return m;
            const name = patch.name !== undefined ? patch.name.slice(0, 32) : m.name;
            const detail = patch.detail !== undefined ? patch.detail.slice(0, 40) : m.detail;
            return { ...m, name, detail, initials: makeInitials(name) };
          }),
        })),

      addMember: (input) =>
        set((state) => {
          const name = input.name.trim().slice(0, 32);
          if (!name) return state;
          const home = state.places.find((p) => p.kind === "home") ?? state.places[0];
          const lat = (home?.lat ?? HOME.lat) + (Math.random() - 0.5) * 0.0004;
          const lng = (home?.lng ?? HOME.lng) + (Math.random() - 0.5) * 0.0004;
          const now = Date.now();
          const id = uid("m");
          const detail = (input.detail.trim() || input.role).slice(0, 40);
          const person: Member = {
            id,
            name,
            role: input.role,
            detail: detail.charAt(0).toUpperCase() + detail.slice(1),
            initials: makeInitials(name),
            lat,
            lng,
            mps: input.role === "child" ? 1.2 : 3.2,
            speed: 0,
            battery: 55 + Math.floor(Math.random() * 40),
            sharing: true,
            hold: false,
            placeId: home?.id ?? null,
            updatedAt: now,
            trail: [],
            route: loopAround(home?.lat ?? HOME.lat, home?.lng ?? HOME.lng),
            routeIndex: 1,
            dwellUntil: now + 8_000,
          };
          return {
            members: [...state.members, person],
            selectedId: id,
            tab: "people",
            events: [event("joined", id, now), ...state.events].slice(0, 60),
          };
        }),

      removeMember: (id) =>
        set((state) => {
          if (id === ME) return state;
          const person = state.members.find((m) => m.id === id);
          if (!person) return state;
          return {
            members: state.members.filter((m) => m.id !== id),
            selectedId: state.selectedId === id ? null : state.selectedId,
            pending: state.pending.filter((p) => p.memberId !== id),
            events: [event("left", id, Date.now(), { note: person.name }), ...state.events].slice(0, 60),
          };
        }),

      setDropping: (on) => set({ dropping: on }),

      addPlace: (input) =>
        set((state) => {
          const name = input.name.trim().slice(0, 32);
          if (!name) return state;
          const center = readCenter();
          const now = Date.now();
          const place: Place = {
            id: uid("p"),
            name,
            kind: input.kind,
            lat: center.lat,
            lng: center.lng,
            radius: input.radius,
          };
          const places = [...state.places, place];
          const fresh: CircleEvent[] = [];
          const members = state.members.map((m) => movedTo(m, m.lat, m.lng, m.speed, now, places, fresh, false));
          return {
            places,
            members,
            dropping: false,
            tab: "places",
            events: [...fresh.reverse(), ...state.events].slice(0, 60),
          };
        }),

      removePlace: (id) =>
        set((state) => {
          const place = state.places.find((p) => p.id === id);
          if (!place) return state;
          const now = Date.now();
          const places = state.places.filter((p) => p.id !== id);
          const fresh: CircleEvent[] = [];
          const members = state.members.map((m) => {
            if (m.placeId !== id) return m;
            fresh.push(event("leave", m.id, now, { placeId: id, placeName: place.name }));
            return { ...m, placeId: locate(m.lat, m.lng, places, null) };
          });
          return {
            places,
            members,
            events: [...fresh.reverse(), ...state.events].slice(0, 60),
          };
        }),

      askCheckIn: (memberId) => {
        const state = get();
        const person = state.members.find((m) => m.id === memberId);
        if (!person || person.id === ME) return false;
        if (state.pending.some((p) => p.memberId === memberId)) return false;
        const now = Date.now();
        const here = state.places.find((p) => p.id === person.placeId);
        const note = !person.sharing
          ? "Sharing is paused. I’ll answer when I’m back."
          : here
            ? `I’m at ${here.name}. All good.`
            : "I’m out, and I’m fine.";
        set({
          pending: [...state.pending, { memberId, resolveAt: now + 2200, note }],
          events: [event("ask", memberId, now), ...state.events].slice(0, 60),
        });
        return true;
      },

      ping: () => {
        const state = get();
        const now = Date.now();
        if (now < state.pingLockedUntil) return false;
        const responder = state.members.find((m) => m.id !== ME && m.sharing);
        set({
          pingLockedUntil: now + 15_000,
          pending: responder
            ? [...state.pending, { memberId: responder.id, resolveAt: now + 2400, note: "Saw your ping. I’m here." }]
            : state.pending,
          events: [event("ping", ME, now), ...state.events].slice(0, 60),
        });
        return true;
      },

      fit: () => set((state) => ({ fitNonce: state.fitNonce + 1 })),
      locateMe: () =>
        set((state) => ({
          selectedId: ME,
          tab: "people",
          wantGps: true,
          gpsError: null,
          locateNonce: state.locateNonce + 1,
        })),

      tick: (now = Date.now()) =>
        set((state) => {
          const dt = state.lastTick ? Math.min(2, (now - state.lastTick) / 1000) : 1;
          const fresh: CircleEvent[] = [];
          const members = state.members.map((m) => advance(m, dt, now, state.places, fresh));
          const due = state.pending.filter((p) => p.resolveAt <= now && members.some((m) => m.id === p.memberId));
          for (const item of due) fresh.push(event("checkin", item.memberId, now, { note: item.note }));
          const pending = state.pending.filter((p) => p.resolveAt > now);
          return {
            members,
            pending,
            lastTick: now,
            events: fresh.length ? [...fresh.reverse(), ...state.events].slice(0, 60) : state.events,
          };
        }),
    }),
    {
      name: "hearth-circle-v2",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        circleName: state.circleName,
        members: state.members,
        places: state.places,
        events: state.events,
        pending: state.pending,
        introSeen: state.introSeen,
        wantGps: state.wantGps,
        pingLockedUntil: state.pingLockedUntil,
      }),
    },
  ),
);
