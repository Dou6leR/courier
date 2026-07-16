import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Vite marker icon fix
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export interface AddressPickerValue {
  city: string;
  street: string;
  building: string;
  apartment?: string;
  lat: number;
  lon: number;
}

interface Props {
  value: AddressPickerValue;
  onChange: (v: AddressPickerValue) => void;
  label?: string;
}

const DEFAULT_CENTER: [number, number] = [49.8397, 24.0297]; // Lviv

// Throttle: at most 1 Nominatim request per second (global)
let lastNominatimCall = 0;
async function throttleNominatim() {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastNominatimCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

async function reverseGeocode(lat: number, lon: number) {
  await throttleNominatim();
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=uk`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) throw new Error("reverse geocode failed");
  return res.json();
}

async function forwardGeocode(city: string, street: string, building: string) {
  await throttleNominatim();
  const q = [street, building, city].filter(Boolean).join(", ");
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&accept-language=uk`,
    { headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

function ClickHandler({ onPick }: { onPick: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapPanner({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat !== 0 || lon !== 0) map.setView([lat, lon], map.getZoom());
  }, [lat, lon, map]);
  return null;
}

export default function AddressPicker({ value, onChange, label }: Props) {
  const [loading, setLoading] = useState(false);
  const markerRef = useRef<L.Marker | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout>>();
  const skipForwardGeocode = useRef(false);

  const hasPoint = value.lat !== 0 || value.lon !== 0;
  const center: [number, number] = hasPoint ? [value.lat, value.lon] : DEFAULT_CENTER;

  const doForwardGeocode = useCallback(
    async (city: string, street: string, building: string) => {
      if (!street && !building) return;
      setLoading(true);
      try {
        const result = await forwardGeocode(city, street, building);
        if (result) onChange({ ...value, lat: result.lat, lon: result.lon, city, street, building });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.lat, value.lon, value.apartment],
  );

  const scheduleForwardGeocode = useCallback(
    (city: string, street: string, building: string) => {
      clearTimeout(geocodeTimer.current);
      geocodeTimer.current = setTimeout(() => doForwardGeocode(city, street, building), 1200);
    },
    [doForwardGeocode],
  );

  const handleFieldChange = (field: "city" | "street" | "building", val: string) => {
    const next = { ...value, [field]: val };
    onChange(next);
    skipForwardGeocode.current = false;
    scheduleForwardGeocode(next.city, next.street, next.building);
  };

  const handlePick = async (lat: number, lon: number) => {
    skipForwardGeocode.current = true;
    clearTimeout(geocodeTimer.current);
    onChange({ ...value, lat, lon });
    setLoading(true);
    try {
      const data = await reverseGeocode(lat, lon);
      const addr = data.address ?? {};
      onChange({
        ...value,
        lat,
        lon,
        city: addr.city || addr.town || addr.village || addr.hamlet || value.city || "",
        street: addr.road || value.street || "",
        building: addr.house_number || value.building || "",
      });
    } catch {
      // silent; user can edit manually
    } finally {
      setLoading(false);
    }
  };

  
  useEffect(() => {
    if (markerRef.current && hasPoint) {
      markerRef.current.setLatLng([value.lat, value.lon]);
    }
  }, [value.lat, value.lon, hasPoint]);

  return (
    <div className="space-y-2">
      {label && <div className="text-sm font-medium text-gray-700">{label}</div>}
      <div className="h-56 w-full rounded-lg overflow-hidden border border-gray-300">
        <MapContainer
          center={center}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={handlePick} />
          <MapPanner lat={value.lat} lon={value.lon} />
          {hasPoint && (
            <Marker
              position={[value.lat, value.lon]}
              draggable
              ref={(m) => {
                markerRef.current = m;
              }}
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng();
                  handlePick(ll.lat, ll.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      {loading && <div className="text-xs text-gray-500">Пошук адреси…</div>}
      <div className="space-y-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Місто</label>
          <input
            type="text"
            placeholder="напр. Львів"
            value={value.city}
            onChange={(e) => handleFieldChange("city", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Вулиця</label>
          <input
            type="text"
            placeholder="напр. вул. Шевченка"
            value={value.street}
            onChange={(e) => handleFieldChange("street", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Будинок</label>
            <input
              type="text"
              placeholder="напр. 27"
              value={value.building}
              onChange={(e) => handleFieldChange("building", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Квартира</label>
            <input
              type="text"
              placeholder="необов'язково"
              value={value.apartment ?? ""}
              onChange={(e) => onChange({ ...value, apartment: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
