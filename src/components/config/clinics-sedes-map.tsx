'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Mail, MapPin, Phone } from 'lucide-react';
import * as React from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Sede } from '@/lib/types';

// Fix Leaflet default icon paths broken by webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface GeoPoint {
    lat: number;
    lng: number;
}

// Module-level cache to avoid re-geocoding the same address
const geocodeCache = new Map<string, GeoPoint | null>();

async function geocodeAddress(address: string): Promise<GeoPoint | null> {
    if (geocodeCache.has(address)) return geocodeCache.get(address)!;
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'IIA-Studio/1.0' } }
        );
        const data = await res.json();
        const point = data[0]
            ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
            : null;
        geocodeCache.set(address, point);
        return point;
    } catch {
        geocodeCache.set(address, null);
        return null;
    }
}

// Delay between Nominatim requests (rate limit: 1 req/s)
function sleep(ms: number) {
    return new Promise<void>((res) => setTimeout(res, ms));
}

interface MarkerData {
    sede?: Sede;
    point: GeoPoint;
    label: string;
    address?: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
}

function FitBounds({ markers }: { markers: MarkerData[] }) {
    const map = useMap();
    React.useEffect(() => {
        if (markers.length === 0) return;
        if (markers.length === 1) {
            map.setView([markers[0].point.lat, markers[0].point.lng], 14);
        } else {
            const bounds = L.latLngBounds(markers.map((m) => [m.point.lat, m.point.lng]));
            map.fitBounds(bounds, { padding: [40, 40] });
        }
    }, [map, markers]);
    return null;
}

export interface ClinicsSedesMapProps {
    sedes: Sede[];
    clinicAddress?: string;
    activeLabel?: string;
    inactiveLabel?: string;
}

export default function ClinicsSedesMap({
    sedes,
    clinicAddress,
    activeLabel = 'Activa',
    inactiveLabel = 'Inactiva',
}: ClinicsSedesMapProps) {
    const [markers, setMarkers] = React.useState<MarkerData[]>([]);

    React.useEffect(() => {
        let cancelled = false;

        async function geocodeAll() {
            const result: MarkerData[] = [];

            const sedesWithAddress = sedes.filter((s) => s.address?.trim());

            for (let i = 0; i < sedesWithAddress.length; i++) {
                if (cancelled) return;
                const s = sedesWithAddress[i];
                if (i > 0) await sleep(1100); // Nominatim rate limit
                const point = await geocodeAddress(s.address!);
                if (point && !cancelled) {
                    result.push({
                        sede: s,
                        point,
                        label: s.name,
                        address: s.address,
                        phone: s.phone,
                        email: s.email,
                        isActive: s.is_active,
                    });
                }
            }

            // Fallback to clinic address when no sedes have geocodeable addresses
            if (result.length === 0 && clinicAddress?.trim()) {
                if (sedesWithAddress.length > 0) await sleep(1100);
                const point = await geocodeAddress(clinicAddress);
                if (point && !cancelled) {
                    result.push({ point, label: clinicAddress, address: clinicAddress });
                }
            }

            if (!cancelled) setMarkers(result);
        }

        geocodeAll();
        return () => { cancelled = true; };
    }, [sedes, clinicAddress]);

    return (
        <MapContainer
            center={[-34.9011, -56.1645]}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds markers={markers} />
            {markers.map((m, i) => (
                <Marker key={i} position={[m.point.lat, m.point.lng]}>
                    <Popup minWidth={200}>
                        <div className="space-y-1 py-0.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm leading-tight">{m.label}</span>
                                {m.isActive !== undefined && (
                                    <span
                                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium leading-tight"
                                        style={{
                                            background: m.isActive ? '#dcfce7' : '#f3f4f6',
                                            color: m.isActive ? '#15803d' : '#6b7280',
                                        }}
                                    >
                                        {m.isActive ? activeLabel : inactiveLabel}
                                    </span>
                                )}
                            </div>
                            {m.address && (
                                <div className="flex items-start gap-1 text-xs text-gray-600">
                                    <MapPin className="h-3 w-3 flex-none mt-0.5" />
                                    <span>{m.address}</span>
                                </div>
                            )}
                            {m.phone && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Phone className="h-3 w-3 flex-none" />
                                    <span>{m.phone}</span>
                                </div>
                            )}
                            {m.email && (
                                <div className="flex items-center gap-1 text-xs text-gray-600">
                                    <Mail className="h-3 w-3 flex-none" />
                                    <span>{m.email}</span>
                                </div>
                            )}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
