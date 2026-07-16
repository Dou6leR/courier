import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { fetchOsrmRoute } from "@/lib/osrm";
import type { RoutePoint } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LatLon {
  lat: number;
  lon: number;
}

interface Props {
  points: RoutePoint[];
  courierLocation: LatLon | null;
  onMapClick?: (lat: number, lon: number) => void;
  onSegmentsChange?: (paths: [number, number][][]) => void;
}

const DEFAULT_CENTER: [number, number] = [49.8397, 24.0297]; // Lviv

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lon: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function numberedIcon(n: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      `<div style="background:${color};color:white;border-radius:9999px;` +
      `width:28px;height:28px;display:flex;align-items:center;justify-content:center;` +
      `font-weight:700;font-size:12px;border:2px solid white;` +
      `box-shadow:0 1px 4px rgba(0,0,0,0.35);">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function courierIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html:
      `<div style="background:#2563eb;border-radius:9999px;width:20px;height:20px;` +
      `border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.25),0 1px 4px rgba(0,0,0,0.35);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function fetchOsrmSegment(
  a: LatLon,
  b: LatLon,
): Promise<[number, number][] | null> {
  return fetchOsrmRoute([a.lat, a.lon], [b.lat, b.lon]);
}

function FitBounds({ bounds }: { bounds: [number, number][] }) {
  const map = useMap();
  const boundsKey = bounds.map((b) => `${b[0]},${b[1]}`).join("|");
  useEffect(() => {
    if (bounds.length < 2) return;
    map.fitBounds(bounds, { padding: [30, 30] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsKey, map]);
  return null;
}

interface SegmentGeom {
  path: [number, number][];
  fallback: boolean;
}

type PlacedPoint = RoutePoint & { lat: number; lon: number };

function distMeters(a: [number, number], b: [number, number]): number {
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

/** Hide the part of `path` that lies behind `pos`. */
function sliceAhead(
  path: [number, number][],
  pos: [number, number],
): [number, number][] {
  if (path.length === 0) return path;
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < path.length; i++) {
    const d = distMeters(path[i], pos);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  // Courier already at/near the end → nothing left to draw.
  if (bestIdx >= path.length - 1) return [pos, path[path.length - 1]];
  return [pos, ...path.slice(bestIdx + 1)];
}

export function CourierRouteMap({
  points,
  courierLocation,
  onMapClick,
  onSegmentsChange,
}: Props) {
  const validPoints = useMemo<PlacedPoint[]>(
    () =>
      points.filter(
        (p): p is PlacedPoint => p.lat != null && p.lon != null,
      ),
    [points],
  );


  const pointsKey = validPoints
    .map((p) => `${p.order_id}-${p.type}`)
    .join("|");


  const [startLocation, setStartLocation] = useState<LatLon | null>(
    courierLocation,
  );
  const prevKeyRef = useRef(pointsKey);
  useEffect(() => {
    if (prevKeyRef.current !== pointsKey) {
      prevKeyRef.current = pointsKey;
      setStartLocation(courierLocation);
      return;
    }
    if (courierLocation == null) return;
    if (startLocation == null) {
      setStartLocation(courierLocation);
      return;
    }

    const dLat = courierLocation.lat - startLocation.lat;
    const dLon = courierLocation.lon - startLocation.lon;
    if (Math.hypot(dLat, dLon) > 0.002) {
      setStartLocation(courierLocation);
    }
  }, [pointsKey, courierLocation, startLocation]);

  const segmentEndpoints = useMemo(() => {
    const pts: LatLon[] = [];
    if (startLocation) pts.push(startLocation);
    for (const p of validPoints) pts.push({ lat: p.lat, lon: p.lon });
    const segs: { from: LatLon; to: LatLon }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({ from: pts[i], to: pts[i + 1] });
    }
    return segs;
  }, [validPoints, startLocation]);

  const [segments, setSegments] = useState<SegmentGeom[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const out: SegmentGeom[] = [];
      for (const seg of segmentEndpoints) {
        const osrm = await fetchOsrmSegment(seg.from, seg.to);
        if (cancelled) return;
        if (osrm && osrm.length >= 2) {
          out.push({ path: osrm, fallback: false });
        } else {
          out.push({
            path: [
              [seg.from.lat, seg.from.lon],
              [seg.to.lat, seg.to.lon],
            ],
            fallback: true,
          });
        }
      }
      if (!cancelled) {
        setSegments(out);
        onSegmentsChange?.(out.map((s) => s.path));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [segmentEndpoints, onSegmentsChange]);

  const bounds: [number, number][] = [];
  if (startLocation) bounds.push([startLocation.lat, startLocation.lon]);
  for (const p of validPoints) bounds.push([p.lat, p.lon]);

  const center: [number, number] =
    bounds.length > 0 ? bounds[0] : DEFAULT_CENTER;

  if (validPoints.length === 0) {
    return (
      <div className="h-[40vh] w-full rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-500">
        Немає точок з координатами для показу на карті
      </div>
    );
  }

  return (
    <div className="h-[40vh] w-full rounded-2xl overflow-hidden border border-gray-200">
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />
        {onMapClick && <ClickHandler onPick={onMapClick} />}
        {courierLocation && (
          <Marker
            position={[courierLocation.lat, courierLocation.lon]}
            icon={courierIcon()}
          >
            <Popup>Ви тут</Popup>
          </Marker>
        )}
        {(() => {
          // Spread out markers that would otherwise stack on identical coords.
          const seen = new Map<string, number>();
          return validPoints.map((p, i) => {
            const key = `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`;
            const idx = seen.get(key) ?? 0;
            seen.set(key, idx + 1);
            let lat = p.lat;
            let lon = p.lon;
            if (idx > 0) {
              const angle = (idx * 60 * Math.PI) / 180;
              const R = 0.00015; // ~15 m
              lat += R * Math.cos(angle);
              lon += R * Math.sin(angle);
            }
            return (
              <Marker
                key={`${p.order_id}-${p.type}-${i}`}
                position={[lat, lon]}
                icon={numberedIcon(
                  i + 1,
                  p.type === "pickup" ? "#16a34a" : "#dc2626",
                )}
              >
                <Popup>
                  <div className="text-sm leading-tight">
                    <div className="font-semibold">
                      #{p.order_id} ·{" "}
                      {p.type === "pickup" ? "Забрати" : "Доставити"}
                    </div>
                    <div className="text-gray-700">
                      {p.address.street}, {p.address.building},{" "}
                      {p.address.city}
                    </div>
                    {p.eta && (
                      <div className="text-gray-500 mt-1">
                        Орієнт.{" "}
                        {new Date(p.eta).toLocaleTimeString("uk-UA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          });
        })()}
        {segments.map((seg, i) => {
          const isActiveLeg = i === 0;
          const path =
            isActiveLeg && courierLocation
              ? sliceAhead(seg.path, [
                  courierLocation.lat,
                  courierLocation.lon,
                ])
              : seg.path;
          return (
            <Polyline
              key={i}
              positions={path}
              pathOptions={{
                color: seg.fallback
                  ? "#94a3b8"
                  : isActiveLeg
                    ? "#16a34a"
                    : "#2563eb",
                weight: isActiveLeg ? 5 : 4,
                opacity: 0.85,
                dashArray: seg.fallback ? "8 6" : undefined,
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}

export default CourierRouteMap;
