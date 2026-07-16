import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { courierApi } from "../api/courier";
import { fetchOsrmRoute } from "@/lib/osrm";
import type { CourierMe } from "../types";

type LatLon = [number, number];

export interface DriveSegment {
  target: LatLon;
  orderId: number;
  type: "pickup" | "delivery";
}

// Demo tempo — base step that gets multiplied by `speed`.
const TICK_MS = 1000;
const BASE_STEP_METERS = 20;
const ARRIVAL_EPSILON_M = 5;

function distMeters(a: LatLon, b: LatLon): number {
  const r = 6371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) *
      Math.cos(toRad(b[0])) *
      Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function moveAlong(cur: LatLon, tgt: LatLon, stepM: number): LatLon {
  const d = distMeters(cur, tgt);
  if (d <= stepM) return tgt;
  const r = stepM / d;
  return [cur[0] + (tgt[0] - cur[0]) * r, cur[1] + (tgt[1] - cur[1]) * r];
}

function sameTargets(a: DriveSegment[], b: DriveSegment[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].orderId !== b[i].orderId || a[i].type !== b[i].type) return false;
  }
  return true;
}

export interface UseAutoDriveParams {
  segments: DriveSegment[];
  start: LatLon | null;
  enabled: boolean;
  speed?: number;
  onReach?: (seg: DriveSegment) => void | Promise<void>;
}

export function useAutoDrive({
  segments,
  start,
  enabled,
  speed = 1,
  onReach,
}: UseAutoDriveParams) {
  const [running, setRunning] = useState(false);
  const posRef = useRef<LatLon | null>(null);
  const segIdxRef = useRef(0);
  const ptIdxRef = useRef(0);
  // Real OSRM polyline of the currently-driven leg, re-fetched when we
  // advance to the next target.
  const pathRef = useRef<LatLon[]>([]);
  const pathLoadingRef = useRef(false);
  const segmentsRef = useRef<DriveSegment[]>(segments);
  const onReachRef = useRef(onReach);
  onReachRef.current = onReach;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const qc = useQueryClient();

  // Reset progress only when the route actually changes (order/type sequence).
  useEffect(() => {
    if (!sameTargets(segmentsRef.current, segments)) {
      segmentsRef.current = segments;
      segIdxRef.current = 0;
      ptIdxRef.current = 0;
      pathRef.current = [];
    } else {
      segmentsRef.current = segments;
    }
  }, [segments]);

  useEffect(() => {
    if (!enabled) setRunning(false);
  }, [enabled]);

  // Fetch a fresh OSRM polyline for the current leg.
  const ensurePath = async () => {
    if (pathLoadingRef.current) return;
    const cur = posRef.current;
    const segs = segmentsRef.current;
    const seg = segs[segIdxRef.current];
    if (!cur || !seg) return;
    pathLoadingRef.current = true;
    try {
      const route = await fetchOsrmRoute(cur, seg.target);
      if (segs !== segmentsRef.current) return;
      if (route && route.length >= 2) {
        pathRef.current = route;
      } else {
        pathRef.current = [cur, seg.target];
      }
      ptIdxRef.current = 0;
    } finally {
      pathLoadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!running) return;

    const tick = async () => {
      let cur = posRef.current;
      if (!cur) {
        setRunning(false);
        return;
      }
      const segs = segmentsRef.current;
      if (segIdxRef.current >= segs.length) {
        setRunning(false);
        return;
      }

      let remaining = BASE_STEP_METERS * Math.max(0.1, speedRef.current);

      while (remaining > 0) {
        if (segIdxRef.current >= segs.length) break;

        if (pathRef.current.length < 2) {
          posRef.current = cur;
          await ensurePath();
          if (pathRef.current.length < 2) break;
        }

        const target = pathRef.current[ptIdxRef.current + 1];
        if (!target) {
          try {
            await onReachRef.current?.(segs[segIdxRef.current]);
          } catch {
            // ignore
          }
          segIdxRef.current += 1;
          ptIdxRef.current = 0;
          pathRef.current = [];
          continue;
        }

        const d = distMeters(cur, target);
        if (d <= remaining) {
          cur = target;
          ptIdxRef.current += 1;
          remaining -= d;
        } else {
          cur = moveAlong(cur, target, remaining);
          remaining = 0;
        }
      }

      posRef.current = cur;
      qc.setQueryData<CourierMe | undefined>(["courier", "me"], (prev) =>
        prev
          ? {
              ...prev,
              last_known_lat: cur[0],
              last_known_lon: cur[1],
              last_location_at: new Date().toISOString(),
            }
          : prev,
      );
      try {
        await courierApi.updateLocation({ lat: cur[0], lon: cur[1] });
      } catch {
        // transient errors ignored
      }
    };

    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [running, qc]);

  return {
    running,
    start: () => {
      if (!start || segments.length === 0) return;
      posRef.current = start;
      segmentsRef.current = segments;
      segIdxRef.current = 0;
      ptIdxRef.current = 0;
      pathRef.current = [];
      setRunning(true);
    },
    stop: () => setRunning(false),
  };
}
