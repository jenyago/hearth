# Hearth

Hearth is a family circle for checking where kids and relatives are. Open it and the first thing you see is a short answer: who is home, who is at school, and where grandpa is. The map sits beside that list. Pins move. Saved places light up when someone arrives or leaves.

This repository is the application source: the map, the circle, the place logic, and the phone GPS path. It is a client app. Locations stay in the browser. There is no account server and no background tracking of someone else's phone.

## What it is for

You want a glance, not a dashboard. "Where is my kid?" and "Where is grandpa?" are the questions the screen is built around.

The sample circle is already moving around Madrid so the app is useful before anyone else joins:

| Person | Role | Starts |
| --- | --- | --- |
| You | This phone | Home |
| Jonah | Son, 5 | Home |
| Isla | Daughter, 8 | North School |
| Hugo | Grandpa | Grandpa's |
| June | Mother | June's flat |
| Ren | Partner | Between home and the studio |
| Theo | Brother | Sharing paused, low battery |

Tap a **Where are they** card and the map flies to that person. Their recent path draws while the card is open.

## What it is not

- Not an emergency service. A ping is a nudge to the circle. It does not call anyone.
- Not covert tracking. People show up after they are in the circle. You cannot switch off someone else's phone. You can remove them.
- Not a multi-phone network. Other members in this build are simulated on this device so you can try places, check-ins, and the log. Only **this phone** uses real GPS, and only after you turn it on.
- The sample names and places are fictional.

## How you use it

**People.** Kids, grandpa, then the rest of the circle, sorted by distance from you. Each row shows a label, a status line (place and motion, or how long sharing has been paused), battery when it is low, and distance.

**A person.** Rename them, see battery, distance, and whether sharing is on. Ask for a check-in. The reply is written from where they are: at a saved place, out, or paused. Remove them if they should not be in the circle.

**This phone.** Turn on GPS. If the browser keeps location off, drop yourself on the map center. Pause sharing. Ping the circle. The header **Sharing** button does the same pause for you.

**Places.** Home, school, work, family, or other. Pick a radius: doorstep (70 m), block (140 m), or campus (240 m). Drag the map; the crosshair is the point that gets saved. Anyone sharing who is inside the circle is listed on that place.

**Log.** Arrivals, departures, check-ins, pings, pauses, and people joining or leaving. The list keeps the latest 60 events.

The circle name is editable. Everything you change is stored on this phone.

## Map

The map is [Leaflet](https://leafletjs.org/) on CARTO dark tiles, which are built from [OpenStreetMap](https://www.openstreetmap.org/copyright). Attribution stays on the map.

- Pins are initials. The selected person is filled copper. A paused person is dim. Someone moving gets a pulse.
- Saved places are copper rings with a small name tag.
- Zoom, show everyone, and find me sit on the map. Find me selects you and asks for GPS.
- On a phone the map is the top half and the circle is a sheet. From 768 px up, the sheet is a 24 rem column on the right.

## This phone's GPS

`AppShell` calls `navigator.geolocation.watchPosition` only when `wantGps` is true. High accuracy, a 4 second cache, and an 8 second timeout. A successful fix updates your pin through `setMyFix` if you are still sharing. Speed comes from the browser when it has one, otherwise from distance over time.

If geolocation is missing or denied, the error is shown in plain language and you can place yourself at the map center. That also turns sharing back on.

## How other people move

Once a second, `tick` advances every member who is sharing, not on hold, and not you.

Each of those people has a route of waypoints. Some waypoints include a pause. While they are dwelling, speed is zero and they stay put. Otherwise they step toward the current waypoint at `mps` meters per second (about walking speed for a child, faster for Ren). Reaching a waypoint snaps to it, advances the route, and starts the pause if there is one.

New people you add get a short loop around home so they are not stuck on one pixel.

Your pin does not follow a route. It moves only from GPS or from dropping yourself on the map.

## Places and the log

`locate` decides which saved place a coordinate is in.

- If the person was already inside a place, they stay "there" until they are outside 1.15 times the radius. That hysteresis stops the log flickering on the edge.
- Otherwise the smallest containing place wins.
- Crossing into a place writes an arrival. Leaving writes a departure. Both name the place.

Check-in replies are queued for a little over two seconds, then written as log lines. A ping is rate-limited to once every 15 seconds and, if someone else is sharing, they answer.

## Data

There is one Zustand store, `useHearth`, persisted to `localStorage` under `hearth-circle-v2`. Hydration is skipped on the server and run on the client so the first paint matches the seed, then your saved circle replaces it.

Persisted fields: circle name, members, places, events, pending check-ins, whether the intro was dismissed, whether GPS was requested, and the ping lock. UI state such as the open tab and the selected person is not persisted.

A member:

- `id`, `name`, `role`, `detail`, `initials`
- `lat`, `lng`, `speed` (meters per second, current), `mps` (cruise speed)
- `battery`, `sharing`, `hold`
- `placeId`, `updatedAt`
- `trail` (last 30 points, about 4 meters of movement apart)
- `route`, `routeIndex`, `dwellUntil`

Roles you can assign: child, partner, parent, sibling, relative. Grandpa is not a separate role. A person counts as grandpa when their name or label matches grandpa, grandfather, grandad, granddad, or abuelo. Hugo's label is "Grandpa", so he gets his own group and a Where card.

You (`id` `"me"`) cannot be removed.

## Files

```
src/routes/Home.tsx                 route: rehydrate, then the shell
src/components/hearth/AppShell.tsx  header, GPS watch, one-second tick
src/components/hearth/MapCanvas.tsx Leaflet map, pins, rings, trails
src/components/hearth/CirclePanel.tsx people, places, log, forms
src/lib/hearth/store.ts             state, movement, places, check-ins
src/lib/hearth/types.ts             member, place, event
src/lib/hearth/geo.ts               distance, place test, wording
src/lib/hearth/seed.ts              Madrid sample circle
src/lib/hearth/map-bridge.ts        map center for "save this spot"
src/styles.css                      ink and copper tokens, sheet, pins
```

Imports use the `@/` alias (`@/lib/hearth/...`, `@/components/hearth/...`).

## Stack

React 19, TypeScript, Zustand with the persist middleware, Leaflet, Tailwind CSS v4, and Lucide icons. Display type is Fraunces. Body type is Outfit. The palette is ink, paper, clay, and one copper accent.

The live app is hosted as a TanStack Start route. `Home.tsx` is that route's component. Drop these modules into a project that already provides React, the alias, Tailwind v4, Leaflet, Lucide, and Zustand. This repo does not vendor the host framework, and it does not contain credentials.

## Design notes

- One accent, used for the primary action, the selected pin, and place rings.
- Tap targets are at least 44 px.
- Map marker HTML is escaped before it is inserted.
- Motion on the live pin is disabled when the user prefers reduced motion.
- The footer states the limit: not an emergency service, and people appear only after they join.
