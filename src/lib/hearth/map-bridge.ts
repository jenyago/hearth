import { HOME } from "@/lib/hearth/seed";

export type LatLng = { lat: number; lng: number };

let reader: () => LatLng = () => ({ ...HOME });

export function registerCenter(fn: () => LatLng): () => void {
  reader = fn;
  return () => {
    if (reader === fn) reader = () => ({ ...HOME });
  };
}

export function readCenter(): LatLng {
  return reader();
}
