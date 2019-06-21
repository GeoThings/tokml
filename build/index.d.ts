import { GeoJSON } from 'geojson';
interface ToKMLOption {
    documentName?: string;
    documentDescription?: string;
    name?: string;
    description?: string;
    simplestyle?: boolean;
    timestamp?: string;
}
export default function tokml(geojson: GeoJSON, initialOptions?: ToKMLOption): string;
export {};
