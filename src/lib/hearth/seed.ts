import type { CircleEvent, Member, Place, Waypoint } from "@/lib/hearth/types";
import { makeInitials, uid } from "@/lib/hearth/geo";

export const HOME = { lat: 40.4352, lng: -3.7048 };

const SCHOOL = { lat: 40.4396, lng: -3.6972 };
const STUDIO = { lat: 40.4268, lng: -3.6965 };
const JUNE = { lat: 40.4421, lng: -3.7116 };
const HUGO = { lat: 40.4246, lng: -3.7178 };

function wp(lat: number, lng: number, pauseMs?: number): Waypoint {
  return pauseMs ? { lat, lng, pauseMs } : { lat, lng };
}

function base(
  partial: Pick<Member, "id" | "name" | "role" | "detail" | "lat" | "lng"> &
    Partial<Member>,
  now: number,
): Member {
  return {
    mps: 0,
    speed: 0,
    battery: 80,
    sharing: true,
    hold: false,
    placeId: null,
    updatedAt: now,
    trail: [],
    route: [],
    routeIndex: 0,
    dwellUntil: 0,
    initials: makeInitials(partial.name),
    ...partial,
  };
}

export function createSeed(now = Date.now()): {
  circleName: string;
  members: Member[];
  places: Place[];
  events: CircleEvent[];
} {
  const places: Place[] = [
    { id: "home", name: "Home", kind: "home", ...HOME, radius: 90 },
    { id: "school", name: "North School", kind: "school", ...SCHOOL, radius: 130 },
    { id: "studio", name: "Studio", kind: "work", ...STUDIO, radius: 100 },
    { id: "june", name: "June’s flat", kind: "family", ...JUNE, radius: 80 },
    { id: "hugo", name: "Grandpa’s", kind: "family", ...HUGO, radius: 80 },
  ];

  const me = base(
    {
      id: "me",
      name: "You",
      role: "you",
      detail: "This phone",
      ...HOME,
      battery: 76,
      placeId: "home",
      hold: true,
    },
    now,
  );

  const isla = base(
    {
      id: "isla",
      name: "Isla",
      role: "child",
      detail: "Daughter · 8",
      ...SCHOOL,
      mps: 1.3,
      battery: 64,
      placeId: "school",
      route: [
        wp(SCHOOL.lat, SCHOOL.lng, 12_000),
        wp(SCHOOL.lat + 0.00035, SCHOOL.lng + 0.00025, 8_000),
        wp(SCHOOL.lat - 0.0002, SCHOOL.lng + 0.0004, 8_000),
        wp(SCHOOL.lat - 0.00028, SCHOOL.lng - 0.00022, 8_000),
      ],
      routeIndex: 1,
      dwellUntil: now + 12_000,
    },
    now,
  );

  const jonah = base(
    {
      id: "jonah",
      name: "Jonah",
      role: "child",
      detail: "Son · 5",
      lat: HOME.lat + 0.00012,
      lng: HOME.lng - 0.00008,
      mps: 0.8,
      battery: 41,
      placeId: "home",
      route: [
        wp(HOME.lat, HOME.lng, 40_000),
        wp(HOME.lat + 0.00022, HOME.lng + 0.00018, 20_000),
        wp(HOME.lat - 0.00018, HOME.lng + 0.00012, 20_000),
      ],
      routeIndex: 1,
      dwellUntil: now + 25_000,
    },
    now,
  );

  const ren = base(
    {
      id: "ren",
      name: "Ren",
      role: "partner",
      detail: "Partner",
      lat: 40.4312,
      lng: -3.7006,
      mps: 9,
      speed: 9,
      battery: 18,
      placeId: null,
      trail: [
        { lat: 40.4276, lng: -3.6974 },
        { lat: 40.4292, lng: -3.6988 },
        { lat: 40.4304, lng: -3.6998 },
      ],
      route: [
        wp(HOME.lat, HOME.lng, 28_000),
        wp(40.4316, -3.7012),
        wp(STUDIO.lat, STUDIO.lng, 36_000),
        wp(40.4302, -3.6992),
      ],
      routeIndex: 0,
    },
    now,
  );

  const june = base(
    {
      id: "june",
      name: "June",
      role: "parent",
      detail: "Mother",
      ...JUNE,
      battery: 91,
      placeId: "june",
      hold: true,
    },
    now,
  );

  const hugo = base(
    {
      id: "hugo",
      name: "Hugo",
      role: "relative",
      detail: "Grandpa",
      ...HUGO,
      battery: 54,
      placeId: "hugo",
      hold: true,
    },
    now,
  );

  const theo = base(
    {
      id: "theo",
      name: "Theo",
      role: "sibling",
      detail: "Brother",
      lat: 40.4336,
      lng: -3.6904,
      battery: 12,
      sharing: false,
      hold: true,
      placeId: null,
      updatedAt: now - 1000 * 60 * 125,
    },
    now,
  );

  const events: CircleEvent[] = [
    {
      id: uid("ev"),
      kind: "leave",
      memberId: "ren",
      placeId: "studio",
      placeName: "Studio",
      at: now - 1000 * 60 * 16,
    },
    {
      id: uid("ev"),
      kind: "arrive",
      memberId: "isla",
      placeId: "school",
      placeName: "North School",
      at: now - 1000 * 60 * 48,
    },
    {
      id: uid("ev"),
      kind: "arrive",
      memberId: "jonah",
      placeId: "home",
      placeName: "Home",
      at: now - 1000 * 60 * 80,
    },
    {
      id: uid("ev"),
      kind: "arrive",
      memberId: "hugo",
      placeId: "hugo",
      placeName: "Grandpa’s",
      at: now - 1000 * 60 * 30,
    },
    {
      id: uid("ev"),
      kind: "pause",
      memberId: "theo",
      at: now - 1000 * 60 * 125,
    },
    {
      id: uid("ev"),
      kind: "checkin",
      memberId: "june",
      placeId: "june",
      placeName: "June’s flat",
      note: "Home with tea. All quiet.",
      at: now - 1000 * 60 * 190,
    },
  ];

  return {
    circleName: "Home circle",
    members: [me, isla, jonah, ren, june, hugo, theo],
    places,
    events,
  };
}
