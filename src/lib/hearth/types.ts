export type Role = "you" | "child" | "partner" | "parent" | "sibling" | "relative";

export type AddRole = Exclude<Role, "you">;

export type PlaceKind = "home" | "school" | "work" | "family" | "other";

export type Tab = "people" | "places" | "log";

export type EventKind =
  | "arrive"
  | "leave"
  | "checkin"
  | "ask"
  | "ping"
  | "pause"
  | "resume"
  | "joined"
  | "left";

export type Waypoint = {
  lat: number;
  lng: number;
  pauseMs?: number;
};

export type TrailPoint = {
  lat: number;
  lng: number;
};

export type Member = {
  id: string;
  name: string;
  role: Role;
  detail: string;
  initials: string;
  lat: number;
  lng: number;
  mps: number;
  speed: number;
  battery: number;
  sharing: boolean;
  hold: boolean;
  placeId: string | null;
  updatedAt: number;
  trail: TrailPoint[];
  route: Waypoint[];
  routeIndex: number;
  dwellUntil: number;
};

export type Place = {
  id: string;
  name: string;
  kind: PlaceKind;
  lat: number;
  lng: number;
  radius: number;
};

export type CircleEvent = {
  id: string;
  kind: EventKind;
  memberId: string;
  at: number;
  placeId?: string;
  placeName?: string;
  note?: string;
};

export type Pending = {
  memberId: string;
  resolveAt: number;
  note: string;
};

export const ME = "me";

export const ROLE_LABEL: Record<AddRole, string> = {
  child: "Child",
  partner: "Partner",
  parent: "Parent",
  sibling: "Sibling",
  relative: "Relative",
};

export const PLACE_LABEL: Record<PlaceKind, string> = {
  home: "Home",
  school: "School",
  work: "Work",
  family: "Family",
  other: "Other",
};

export const RADIUS_CHOICES = [
  { id: "door", label: "Doorstep", meters: 70 },
  { id: "block", label: "Block", meters: 140 },
  { id: "campus", label: "Campus", meters: 240 },
] as const;
