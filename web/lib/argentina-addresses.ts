export type ArgentinaCityOption = {
  id: string;
  city: string;
  // Id de la localidad censal: es lo que pide /calles (distinto del id de
  // localidad que usamos para mostrar/filtrar la ciudad).
  censalId: string;
};

export type ArgentinaProvinceOption = {
  id: string;
  province: string;
};

export type ArgentinaStreetOption = {
  id: string;
  name: string;
};

type GeorefProvinceResponse = {
  provincias: Array<{
    id: string;
    nombre: string;
  }>;
  cantidad: number;
  total: number;
  inicio: number;
};

type GeorefLocalidadesResponse = {
  localidades: Array<{
    id: string;
    nombre: string;
    localidad_censal?: { id: string };
  }>;
  cantidad: number;
  total: number;
  inicio: number;
};

type GeorefCallesResponse = {
  calles: Array<{
    id: string;
    nombre: string;
    localidad_censal?: {
      nombre?: string;
    };
    nomenclatura?: string;
  }>;
};

const GEOREF_API_BASE = 'https://apis.datos.gob.ar/georef/api';
// Máximo que la propia API de Georef permite por página
const GEOREF_MAX_PAGE_SIZE = 5000;

async function georefRequest<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GEOREF_API_BASE}${path}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), { cache: 'no-store' });

  if (!response.ok) {
    throw new Error('No se pudo cargar la información de dirección');
  }

  return (await response.json()) as T;
}

export async function fetchArgentinaProvinces(): Promise<ArgentinaProvinceOption[]> {
  const data = await georefRequest<GeorefProvinceResponse>('/provincias', {
    campos: 'id,nombre',
    max: String(GEOREF_MAX_PAGE_SIZE),
  });

  return data.provincias.map(({ id, nombre }) => ({
    id,
    province: nombre,
  }));
}

export async function fetchProvinceCities(provinceId: string): Promise<ArgentinaCityOption[]> {
  const cities: ArgentinaCityOption[] = [];
  let inicio = 0;

  while (true) {
    const data = await georefRequest<GeorefLocalidadesResponse>('/localidades', {
      provincia: provinceId,
      campos: 'id,nombre,localidad_censal.id',
      max: String(GEOREF_MAX_PAGE_SIZE),
      inicio: String(inicio),
    });

    cities.push(
      ...data.localidades.map(({ id, nombre, localidad_censal }) => ({
        id,
        city: nombre,
        censalId: localidad_censal?.id ?? '',
      })),
    );

    inicio += data.cantidad;

    if (data.cantidad === 0 || inicio >= data.total) {
      break;
    }
  }

  return cities;
}

export async function fetchStreetSuggestions(
  censalId: string,
  search: string,
): Promise<ArgentinaStreetOption[]> {
  const cleaned = search.trim();

  if (!cleaned) {
    return [];
  }

  // El endpoint /calles no acepta el id de localidad "común" (el que usan
  // /localidades y el resto de esta API): pide localidad_censal.
  const data = await georefRequest<GeorefCallesResponse>('/calles', {
    localidad_censal: censalId,
    nombre: cleaned,
    max: '10',
  });

  return data.calles.map(({ id, nombre }) => ({
    id,
    name: nombre,
  }));
}
