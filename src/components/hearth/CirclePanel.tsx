import { useEffect, useState, type ReactNode } from "react";
import {
  BatteryWarning,
  Bell,
  Briefcase,
  ChevronLeft,
  GraduationCap,
  Heart,
  House,
  MapPin,
  Plus,
  ScrollText,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { describeEvent, formatClock, formatDistance, haversine, statusLine, whereLine } from "@/lib/hearth/geo";
import {
  ME,
  PLACE_LABEL,
  RADIUS_CHOICES,
  ROLE_LABEL,
  type AddRole,
  type Member,
  type Place,
  type PlaceKind,
  type Tab,
} from "@/lib/hearth/types";
import { useHearth } from "@/lib/hearth/store";

const FIELD =
  "w-full rounded-xl border border-line bg-ink px-3 py-3 text-base text-paper outline-none";

export function CirclePanel() {
  const tab = useHearth((s) => s.tab);
  const setTab = useHearth((s) => s.setTab);
  const members = useHearth((s) => s.members);
  const places = useHearth((s) => s.places);
  const selectedId = useHearth((s) => s.selectedId);
  const select = useHearth((s) => s.select);
  const introSeen = useHearth((s) => s.introSeen);
  const dismissIntro = useHearth((s) => s.dismissIntro);
  const [mode, setMode] = useState<"add" | "place" | null>(null);
  const setDropping = useHearth((s) => s.setDropping);

  useEffect(() => {
    setDropping(mode === "place");
    return () => setDropping(false);
  }, [mode, setDropping]);

  const selected = members.find((m) => m.id === selectedId) ?? null;
  const sharingCount = members.filter((m) => m.sharing).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!introSeen ? (
        <div className="flex items-center gap-2 border-b border-line px-4 py-1">
          <p className="min-w-0 flex-1 text-sm text-clay">Sample family, on this phone only.</p>
          <button
            type="button"
            onClick={dismissIntro}
            className="min-h-11 shrink-0 text-sm font-medium text-paper"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="flex shrink-0 border-b border-line" role="tablist" aria-label="Circle sections">
        <TabButton id="people" label="People" icon={<Users className="size-4" />} active={tab === "people"} onClick={() => { setMode(null); setTab("people"); }} />
        <TabButton id="places" label="Places" icon={<MapPin className="size-4" />} active={tab === "places"} onClick={() => { select(null); setMode(null); setTab("places"); }} />
        <TabButton id="log" label="Log" icon={<ScrollText className="size-4" />} active={tab === "log"} onClick={() => { select(null); setMode(null); setTab("log"); }} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {tab === "people" && mode === "add" ? (
          <AddPerson onClose={() => setMode(null)} />
        ) : tab === "people" && selected ? (
          <MemberDetail member={selected} onBack={() => select(null)} />
        ) : tab === "people" ? (
          <PeopleList
            members={members}
            places={places}
            sharingCount={sharingCount}
            selectedId={selectedId}
            onAdd={() => {
              select(null);
              setMode("add");
            }}
            onOpen={(id) => select(id)}
          />
        ) : tab === "places" && mode === "place" ? (
          <AddPlace onClose={() => setMode(null)} />
        ) : tab === "places" ? (
          <PlacesList places={places} members={members} onAdd={() => setMode("place")} />
        ) : (
          <LogList />
        )}
      </div>

      <p className="shrink-0 border-t border-line px-4 py-2 text-xs leading-snug text-clay">
        Not an emergency service. People show up only after they join.
      </p>
    </div>
  );
}

function TabButton({
  id,
  label,
  icon,
  active,
  onClick,
}: {
  id: Tab;
  label: string;
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-11 flex-1 items-center justify-center gap-2 text-sm font-medium ${active ? "border-b-2 border-copper text-paper" : "text-clay"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function PeopleList({
  members,
  places,
  sharingCount,
  selectedId,
  onAdd,
  onOpen,
}: {
  members: Member[];
  places: Place[];
  sharingCount: number;
  selectedId: string | null;
  onAdd: () => void;
  onOpen: (id: string) => void;
}) {
  const me = members.find((m) => m.id === ME);
  const rest = members.filter((m) => m.id !== ME);
  const kids = rest.filter((m) => m.role === "child").sort((a, b) => dist(a, me) - dist(b, me));
  const grandpas = rest.filter(isGrandpa);
  const relatives = rest
    .filter((m) => m.role !== "child" && !isGrandpa(m))
    .sort((a, b) => dist(a, me) - dist(b, me));
  const checks = [
    ...kids.map((member) => ({ member, label: "Kid" })),
    ...grandpas.map((member) => ({ member, label: "Grandpa" })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {checks.length > 0 ? (
        <section className="flex flex-col gap-1.5">
          <h2 className="text-xs font-medium tracking-wide text-clay uppercase">Where are they</h2>
          <div className="grid grid-cols-2 gap-2">
            {checks.map(({ member, label }) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onOpen(member.id)}
                aria-pressed={selectedId === member.id}
                className={`flex min-h-20 flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left ${selectedId === member.id ? "border-copper bg-panel-2" : "border-line bg-ink"}`}
              >
                <span className="text-xs font-medium tracking-wide text-clay uppercase">{label}</span>
                <span className="truncate font-medium">{member.name || "Unnamed"}</span>
                <span className="line-clamp-2 text-sm text-paper">
                  {member.sharing ? whereLine(member, places) : "Sharing paused"}
                </span>
                <span className="text-sm text-clay tabular-nums">
                  {me ? formatDistance(haversine(me.lat, me.lng, member.lat, member.lng)) : ""}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-clay">{sharingCount} sharing</p>
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-11 items-center gap-2 rounded-full bg-copper px-4 text-sm font-medium text-copper-ink"
        >
          <Plus className="size-4" />
          Add
        </button>
      </div>
      {kids.length > 0 ? (
        <Group title="Kids">
          {kids.map((m) => (
            <PersonRow key={m.id} member={m} me={me} places={places} onOpen={onOpen} />
          ))}
        </Group>
      ) : null}
      {grandpas.length > 0 ? (
        <Group title="Grandpa">
          {grandpas.map((m) => (
            <PersonRow key={m.id} member={m} me={me} places={places} onOpen={onOpen} />
          ))}
        </Group>
      ) : null}
      {relatives.length > 0 ? (
        <Group title="Relatives">
          {relatives.map((m) => (
            <PersonRow key={m.id} member={m} me={me} places={places} onOpen={onOpen} />
          ))}
        </Group>
      ) : null}
      {me ? (
        <Group title="This phone">
          <PersonRow member={me} me={me} places={places} onOpen={onOpen} />
        </Group>
      ) : null}
      {members.length <= 1 ? (
        <p className="text-sm text-clay">The circle is just this phone. Add a child or a relative.</p>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-xs font-medium tracking-wide text-clay uppercase">{title}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function PersonRow({
  member,
  me,
  places,
  onOpen,
}: {
  member: Member;
  me: Member | undefined;
  places: Place[];
  onOpen: (id: string) => void;
}) {
  const away =
    me && member.id !== ME ? formatDistance(haversine(me.lat, me.lng, member.lat, member.lng)) : "You";
  return (
    <button
      type="button"
      onClick={() => onOpen(member.id)}
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-line bg-ink px-3 py-2 text-left"
    >
      <Avatar member={member} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium">{member.name || "Unnamed"}</span>
          <span className="truncate text-sm text-clay">{member.detail}</span>
          {member.battery <= 20 ? <BatteryWarning className="size-4 shrink-0 text-copper" aria-label="Low battery" /> : null}
        </span>
        <span className="block truncate text-sm text-paper">{statusLine(member, places)}</span>
      </span>
      <span className="shrink-0 text-sm text-clay tabular-nums">{away}</span>
    </button>
  );
}

function Avatar({ member }: { member: Member }) {
  const on = member.sharing;
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${on ? "border-copper text-paper" : "border-line text-clay"}`}
      aria-hidden
    >
      {member.initials}
    </span>
  );
}

function MemberDetail({ member, onBack }: { member: Member; onBack: () => void }) {
  const places = useHearth((s) => s.places);
  const members = useHearth((s) => s.members);
  const pending = useHearth((s) => s.pending);
  const renameMember = useHearth((s) => s.renameMember);
  const removeMember = useHearth((s) => s.removeMember);
  const askCheckIn = useHearth((s) => s.askCheckIn);
  const ping = useHearth((s) => s.ping);
  const toggleMySharing = useHearth((s) => s.toggleMySharing);
  const setWantGps = useHearth((s) => s.setWantGps);
  const wantGps = useHearth((s) => s.wantGps);
  const gpsError = useHearth((s) => s.gpsError);
  const dropMeAtCenter = useHearth((s) => s.dropMeAtCenter);
  const pingLockedUntil = useHearth((s) => s.pingLockedUntil);
  const [confirm, setConfirm] = useState(false);
  const me = members.find((m) => m.id === ME);
  const isMe = member.id === ME;
  const waiting = pending.some((p) => p.memberId === member.id);
  const pingLocked = Date.now() < pingLockedUntil;
  const away =
    !isMe && me ? formatDistance(haversine(me.lat, me.lng, member.lat, member.lng)) : "This phone";

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-1 self-start text-sm text-clay">
        <ChevronLeft className="size-4" />
        People
      </button>
      <div className="flex items-center gap-3">
        <Avatar member={member} />
        <div className="min-w-0">
          <h2 className="font-display text-3xl leading-none">{member.name || "Unnamed"}</h2>
          <p className="text-sm text-clay">{statusLine(member, places)}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm text-clay">
        Name
        <input
          className={FIELD}
          value={member.name}
          maxLength={32}
          onChange={(e) => renameMember(member.id, { name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-clay">
        Label
        <input
          className={FIELD}
          value={member.detail}
          maxLength={40}
          onChange={(e) => renameMember(member.id, { detail: e.target.value })}
        />
      </label>

      <dl className="grid grid-cols-2 gap-2">
        <Stat label="Battery" value={`${member.battery}%`} />
        <Stat label="From you" value={away} />
        <Stat label="Updated" value={member.sharing ? "Live" : "Paused"} />
        <Stat label="Sharing" value={member.sharing ? "On" : "Off"} />
      </dl>
      <div className="h-1 overflow-hidden rounded-full bg-panel-2" aria-hidden>
        <div className="h-full rounded-full bg-copper" style={{ width: `${Math.max(0, Math.min(100, member.battery))}%` }} />
      </div>
      <p className="text-sm text-clay">The recent path shows on the map while this person is open.</p>

      {isMe ? (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setWantGps(true)}
            className="min-h-12 rounded-full bg-copper px-4 text-sm font-medium text-copper-ink"
          >
            {wantGps ? "Listening for this phone’s GPS" : "Use this phone’s GPS"}
          </button>
          <button
            type="button"
            onClick={dropMeAtCenter}
            className="min-h-12 rounded-full border border-line px-4 text-sm font-medium"
          >
            Put me at the map center
          </button>
          <button
            type="button"
            onClick={toggleMySharing}
            className="min-h-12 rounded-full border border-line px-4 text-sm font-medium"
          >
            {member.sharing ? "Pause my location" : "Share my location again"}
          </button>
          <button
            type="button"
            onClick={() => ping()}
            disabled={pingLocked}
            className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-line px-4 text-sm font-medium"
          >
            <Bell className="size-4" />
            {pingLocked ? "Ping sent" : "Ping the circle"}
          </button>
          {gpsError ? <p className="text-sm text-clay">{gpsError}</p> : null}
          <p className="text-sm text-clay">A ping notifies the circle. It does not call emergency services.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => askCheckIn(member.id)}
            disabled={waiting}
            className="min-h-12 rounded-full bg-copper px-4 text-sm font-medium text-copper-ink"
          >
            {waiting ? "Waiting for a reply…" : "Ask for a check-in"}
          </button>
          <p className="text-sm text-clay">
            You can’t switch off their phone. Remove them if they shouldn’t be in the circle.
          </p>
          {confirm ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
              <p className="text-sm">Remove {member.name} from the circle?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => removeMember(member.id)}
                  className="min-h-11 flex-1 rounded-full bg-copper text-sm font-medium text-copper-ink"
                >
                  Remove
                </button>
                <button
                  type="button"
                  onClick={() => setConfirm(false)}
                  className="min-h-11 flex-1 rounded-full border border-line text-sm"
                >
                  Keep
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="flex min-h-11 items-center justify-center gap-2 text-sm text-clay"
            >
              <Trash2 className="size-4" />
              Remove from circle
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-ink px-3 py-2">
      <dt className="text-xs text-clay">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  );
}

function AddPerson({ onClose }: { onClose: () => void }) {
  const addMember = useHearth((s) => s.addMember);
  const [name, setName] = useState("");
  const [role, setRole] = useState<AddRole>("child");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Add a name.");
          return;
        }
        addMember({ name, role, detail: detail.trim() || ROLE_LABEL[role] });
        onClose();
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Add someone</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center">
          <X className="size-4" />
        </button>
      </div>
      <p className="text-sm text-clay">
        On a real circle they accept an invite on their phone. Here they join this preview so you can try it.
      </p>
      <label className="flex flex-col gap-1 text-sm text-clay">
        Name
        <input className={FIELD} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Maya" />
      </label>
      <div className="flex flex-col gap-2">
        <span className="text-sm text-clay">They are</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ROLE_LABEL) as AddRole[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              className={`min-h-11 rounded-full px-3 text-sm ${role === key ? "bg-copper text-copper-ink" : "border border-line text-clay"}`}
            >
              {ROLE_LABEL[key]}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1 text-sm text-clay">
        Label
        <input
          className={FIELD}
          value={detail}
          maxLength={40}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Daughter · 8"
        />
      </label>
      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <button type="submit" className="min-h-12 rounded-full bg-copper text-sm font-medium text-copper-ink">
        Add to the circle
      </button>
    </form>
  );
}

function PlacesList({
  places,
  members,
  onAdd,
}: {
  places: Place[];
  members: Member[];
  onAdd: () => void;
}) {
  const removePlace = useHearth((s) => s.removePlace);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Places</h2>
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-11 items-center gap-2 rounded-full bg-copper px-4 text-sm font-medium text-copper-ink"
        >
          <Plus className="size-4" />
          Save
        </button>
      </div>
      <p className="text-sm text-clay">Arrivals and departures are noted when someone crosses a place.</p>
      {places.map((place) => {
        const here = members.filter((m) => m.sharing && m.placeId === place.id);
        return (
          <article key={place.id} className="flex items-start gap-3 rounded-2xl border border-line bg-ink px-3 py-3">
            <span className="mt-0.5 text-copper">{placeIcon(place.kind)}</span>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium">{place.name}</h3>
              <p className="text-sm text-clay">
                {PLACE_LABEL[place.kind]} · {place.radius} m
              </p>
              <p className="text-sm text-paper">
                {here.length > 0 ? here.map((m) => m.name).join(", ") : "No one here"}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Remove ${place.name}`}
              onClick={() => removePlace(place.id)}
              className="flex size-11 items-center justify-center text-clay"
            >
              <Trash2 className="size-4" />
            </button>
          </article>
        );
      })}
    </div>
  );
}

function AddPlace({ onClose }: { onClose: () => void }) {
  const addPlace = useHearth((s) => s.addPlace);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PlaceKind>("home");
  const [radius, setRadius] = useState<number>(RADIUS_CHOICES[1].meters);
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          setError("Name this place.");
          return;
        }
        addPlace({ name, kind, radius });
        onClose();
      }}
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">Save a place</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center">
          <X className="size-4" />
        </button>
      </div>
      <p className="text-sm text-clay">Drag the map. The crosshair is the spot that gets saved.</p>
      <label className="flex flex-col gap-1 text-sm text-clay">
        Name
        <input className={FIELD} value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="School" />
      </label>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PLACE_LABEL) as PlaceKind[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setKind(key)}
            className={`min-h-11 rounded-full px-3 text-sm ${kind === key ? "bg-copper text-copper-ink" : "border border-line text-clay"}`}
          >
            {PLACE_LABEL[key]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {RADIUS_CHOICES.map((choice) => (
          <button
            key={choice.id}
            type="button"
            onClick={() => setRadius(choice.meters)}
            className={`min-h-11 rounded-full px-3 text-sm ${radius === choice.meters ? "bg-copper text-copper-ink" : "border border-line text-clay"}`}
          >
            {choice.label}
          </button>
        ))}
      </div>
      {error ? <p className="text-sm text-copper">{error}</p> : null}
      <button type="submit" className="min-h-12 rounded-full bg-copper text-sm font-medium text-copper-ink">
        Save place
      </button>
    </form>
  );
}

function LogList() {
  const events = useHearth((s) => s.events);
  const members = useHearth((s) => s.members);
  const places = useHearth((s) => s.places);
  if (events.length === 0) return <p className="text-sm text-clay">Nothing yet. Movement will show up here.</p>;
  return (
    <ol className="flex flex-col">
      {events.map((item) => (
        <li key={item.id} className="flex gap-3 border-b border-line py-3">
          <time className="w-16 shrink-0 text-sm text-clay tabular-nums">{formatClock(item.at)}</time>
          <p className="text-sm">{describeEvent(item, members, places)}</p>
        </li>
      ))}
    </ol>
  );
}

function placeIcon(kind: PlaceKind) {
  const className = "size-5";
  switch (kind) {
    case "home":
      return <House className={className} />;
    case "school":
      return <GraduationCap className={className} />;
    case "work":
      return <Briefcase className={className} />;
    case "family":
      return <Heart className={className} />;
    default:
      return <MapPin className={className} />;
  }
}

function dist(member: Member, me: Member | undefined): number {
  if (!me) return 0;
  return haversine(me.lat, me.lng, member.lat, member.lng);
}

function isGrandpa(member: Member): boolean {
  return /\b(grandpa|grandfather|grandad|granddad|abuelo)\b/i.test(`${member.name} ${member.detail}`);
}
