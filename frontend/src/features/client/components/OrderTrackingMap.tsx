import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2 } from "lucide-react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { fetchOsrmRoute } from "@/lib/osrm";
import type { Order } from "@/features/client/types";

// Vite marker icon fix
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LVIV_CENTER: [number, number] = [49.8397, 24.0297];

const pickupIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #22c55e; border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
    color:white;font-weight:bold;font-size:12px;
  ">P</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const deliveryIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50%;
    background: #2563eb; border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    display:flex;align-items:center;justify-content:center;
    color:white;font-weight:bold;font-size:12px;
  ">D</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const courierIcon = L.divIcon({
  className: "",
  html: `<div style="position:relative;width:40px;height:40px;">
    <div style="
      position:absolute;left:8px;top:8px;width:24px;height:24px;
      border-radius:50%;background:#2563eb;border:3px solid white;
      box-shadow: 0 0 0 6px rgba(37,99,235,0.25);
      animation: pulse 1.5s ease-out infinite;
    "></div>
  </div>
  <style>
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0px rgba(37,99,235,0.5); }
      100% { box-shadow: 0 0 0 12px rgba(37,99,235,0); }
    }
  </style>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

interface Props {
  order: Order;
}

const fetchOsrmSegment = fetchOsrmRoute;

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
  if (bestIdx >= path.length - 1) return [pos, path[path.length - 1]];
  return [pos, ...path.slice(bestIdx + 1)];
}

/** Fit once, then invalidate size whenever fullscreen toggles. */
function MapShell({
  bounds,
  fullscreen,
}: {
  bounds: L.LatLngBoundsExpression | undefined;
  fullscreen: boolean;
}) {
  const map = useMap();
  const didFitRef = useRef(false);

  useEffect(() => {
    if (didFitRef.current || !bounds) return;
    map.fitBounds(bounds, { padding: [20, 20] });
    didFitRef.current = true;
  }, [bounds, map]);

  // Leaflet needs to know the container resized when we toggle fullscreen.
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [fullscreen, map]);

  return null;
}

export default function OrderTrackingMap({ order }: Props) {
  const pickup = order.pickup_address;
  const delivery = order.delivery_address;
  const courierPos = useMemo<[number, number] | null>(() => {
    const c = order.courier;
    if (!c || c.last_known_lat == null || c.last_known_lon == null) return null;
    return [c.last_known_lat, c.last_known_lon];
  }, [order.courier]);

  const [fullscreen, setFullscreen] = useState(false);

  // OSRM polylines:
  //  - activePath: courier → next waypoint (pickup if not yet picked, else delivery)
  //  - remainingPath: pickup → delivery (only before pickup is done)
  const pickupPos: [number, number] | null =
    pickup.lat != null && pickup.lon != null ? [pickup.lat, pickup.lon] : null;
  const deliveryPos: [number, number] | null =
    delivery.lat != null && delivery.lon != null
      ? [delivery.lat, delivery.lon]
      : null;

  const beforePickup =
    order.status === "assigned" || !order.actual_pickup_time;
  const nextStop = beforePickup ? pickupPos : deliveryPos;

  const [activePath, setActivePath] = useState<[number, number][] | null>(null);
  const [remainingPath, setRemainingPath] = useState<
    [number, number][] | null
  >(null);

  // Stable origin of the active leg — recomputed only when the leg target
  // changes (e.g. pickup → delivery after the courier picks the parcel up).
  const activeKey = `${beforePickup ? "p" : "d"}-${courierPos?.[0]?.toFixed(3) ?? "x"}-${courierPos?.[1]?.toFixed(3) ?? "x"}`;
  const activeKeyRef = useRef(activeKey);
  const activeOriginRef = useRef<[number, number] | null>(courierPos);
  useEffect(() => {
    // Re-anchor when leg changes OR first time we get a courier position.
    if (
      activeKeyRef.current !== activeKey ||
      activeOriginRef.current == null
    ) {
      activeKeyRef.current = activeKey;
      activeOriginRef.current = courierPos;
    }
  }, [activeKey, courierPos]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const origin = activeOriginRef.current;
      if (!origin || !nextStop) {
        if (!cancelled) setActivePath(null);
        return;
      }
      const res = await fetchOsrmSegment(origin, nextStop);
      if (cancelled) return;
      setActivePath(res ?? [origin, nextStop]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [nextStop, activeKey]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!beforePickup || !pickupPos || !deliveryPos) {
        if (!cancelled) setRemainingPath(null);
        return;
      }
      const res = await fetchOsrmSegment(pickupPos, deliveryPos);
      if (cancelled) return;
      setRemainingPath(res ?? [pickupPos, deliveryPos]);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [beforePickup, pickupPos?.[0], pickupPos?.[1], deliveryPos?.[0], deliveryPos?.[1]]);

  const activeDrawn = useMemo(() => {
    if (!activePath || !courierPos) return activePath;
    return sliceAhead(activePath, courierPos);
  }, [activePath, courierPos]);

  // ESC exits fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const allPoints: [number, number][] = [];
  if (pickup.lat && pickup.lon) allPoints.push([pickup.lat, pickup.lon]);
  if (delivery.lat && delivery.lon) allPoints.push([delivery.lat, delivery.lon]);
  if (courierPos) allPoints.push(courierPos);

  const center: [number, number] =
    allPoints.length > 0 ? allPoints[0] : LVIV_CENTER;

  const bounds =
    allPoints.length > 1 ? L.latLngBounds(allPoints).pad(0.3) : undefined;

  const wrapperClass = fullscreen
    ? "fixed inset-0 z-50 bg-white"
    : "relative h-56 w-full rounded-lg overflow-hidden border border-gray-200";

  return (
    <div className={wrapperClass}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        <MapShell bounds={bounds} fullscreen={fullscreen} />
        {remainingPath && remainingPath.length >= 2 && (
          <Polyline
            positions={remainingPath}
            pathOptions={{
              color: "#94a3b8",
              weight: 4,
              opacity: 0.7,
              dashArray: "6 6",
            }}
          />
        )}
        {activeDrawn && activeDrawn.length >= 2 && (
          <Polyline
            positions={activeDrawn}
            pathOptions={{ color: "#16a34a", weight: 5, opacity: 0.85 }}
          />
        )}
        {pickup.lat && pickup.lon && (
          <Marker position={[pickup.lat, pickup.lon]} icon={pickupIcon}>
            <Popup>
              <b>Забір</b>
              <br />
              {pickup.street}, {pickup.building}
            </Popup>
          </Marker>
        )}
        {delivery.lat && delivery.lon && (
          <Marker position={[delivery.lat, delivery.lon]} icon={deliveryIcon}>
            <Popup>
              <b>Доставка</b>
              <br />
              {delivery.street}, {delivery.building}
            </Popup>
          </Marker>
        )}
        {courierPos && order.courier && (
          <Marker position={courierPos} icon={courierIcon}>
            <Popup>
              <b>Кур'єр</b>
              <br />
              {order.courier.full_name}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <button
        type="button"
        onClick={() => setFullscreen((v) => !v)}
        aria-label={fullscreen ? "Згорнути карту" : "Розгорнути карту"}
        className="absolute top-2 right-2 z-[500] p-2 bg-white rounded-lg shadow hover:bg-gray-50 border border-gray-200"
      >
        {fullscreen ? (
          <Minimize2 className="w-4 h-4 text-gray-700" />
        ) : (
          <Maximize2 className="w-4 h-4 text-gray-700" />
        )}
      </button>
    </div>
  );
}
