import { ShippingZone } from '@prisma/client';

// Provincias de Argentina (+CABA), usadas para precargar la tabla de
// tarifas de envío. El admin carga el costo real de cada una desde el
// panel (/envios) una vez que tiene la planilla de costos por provincia.
export const ARGENTINA_PROVINCES = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const;

export const SHIPPING_ZONES = Object.values(ShippingZone);

export const SHIPPING_ZONE_LABEL: Record<ShippingZone, string> = {
  AMBA: 'CABA, AMBA y Gran La Plata',
  CENTRO: 'Centro (resto de Buenos Aires, Córdoba, Santa Fe, La Pampa, Entre Ríos)',
  INTERMEDIO: 'NEA / NOA / Cuyo / Patagonia próxima (incluye todo Río Negro)',
  EXTREMO: 'Extremos: Patagonia lejana y norte (Salta, Jujuy, Chubut, Santa Cruz, Tierra del Fuego)',
};

// Provincia -> zona por defecto. Buenos Aires es un caso especial: se
// resuelve por partido en resolveShippingZone (los partidos del AMBA y La
// Plata pagan la tarifa AMBA, el resto de la provincia paga CENTRO).
const PROVINCE_ZONE: Record<string, ShippingZone> = {
  'Ciudad Autónoma de Buenos Aires': ShippingZone.AMBA,
  Córdoba: ShippingZone.CENTRO,
  'Santa Fe': ShippingZone.CENTRO,
  'La Pampa': ShippingZone.CENTRO,
  'Entre Ríos': ShippingZone.CENTRO,
  Mendoza: ShippingZone.INTERMEDIO,
  'San Juan': ShippingZone.INTERMEDIO,
  'San Luis': ShippingZone.INTERMEDIO,
  'La Rioja': ShippingZone.INTERMEDIO,
  Tucumán: ShippingZone.INTERMEDIO,
  Catamarca: ShippingZone.INTERMEDIO,
  'Santiago del Estero': ShippingZone.INTERMEDIO,
  Misiones: ShippingZone.INTERMEDIO,
  Corrientes: ShippingZone.INTERMEDIO,
  Chaco: ShippingZone.INTERMEDIO,
  Formosa: ShippingZone.INTERMEDIO,
  Neuquén: ShippingZone.INTERMEDIO,
  'Río Negro': ShippingZone.INTERMEDIO,
  Salta: ShippingZone.EXTREMO,
  Jujuy: ShippingZone.EXTREMO,
  Chubut: ShippingZone.EXTREMO,
  'Santa Cruz': ShippingZone.EXTREMO,
  'Tierra del Fuego': ShippingZone.EXTREMO,
};

// Partidos del AMBA + La Plata (Gran La Plata): pagan la tarifa AMBA aun
// siendo, administrativamente, provincia de Buenos Aires. Nombres
// completos (sin abreviar) para que matcheen con lo que devuelve la API
// de Georef en el campo "departamento" de una localidad.
const AMBA_PARTIDOS = [
  'Almirante Brown',
  'Avellaneda',
  'Berazategui',
  'Berisso',
  'Brandsen',
  'Campana',
  'Cañuelas',
  'Ensenada',
  'Escobar',
  'Esteban Echeverría',
  'Exaltación de la Cruz',
  'Ezeiza',
  'Florencio Varela',
  'General Las Heras',
  'General Rodríguez',
  'General San Martín',
  'Hurlingham',
  'Ituzaingó',
  'José C. Paz',
  'La Matanza',
  'La Plata',
  'Lanús',
  'Lomas de Zamora',
  'Luján',
  'Malvinas Argentinas',
  'Marcos Paz',
  'Merlo',
  'Moreno',
  'Morón',
  'Quilmes',
  'Pilar',
  'Presidente Perón',
  'San Fernando',
  'San Isidro',
  'San Miguel',
  'San Vicente',
  'Tigre',
  'Tres de Febrero',
  'Vicente López',
  'Zárate',
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

const AMBA_PARTIDOS_NORMALIZED = new Set(AMBA_PARTIDOS.map(normalize));
const PROVINCE_ZONE_NORMALIZED = new Map(
  Object.entries(PROVINCE_ZONE).map(([province, zone]) => [normalize(province), zone]),
);

const BUENOS_AIRES_NORMALIZED = normalize('Buenos Aires');

// Resuelve la zona de envío a partir de la provincia y, para Buenos
// Aires, del partido de destino (el resto de las provincias son
// uniformes: no hace falta la localidad).
export function resolveShippingZone(province: string, partido?: string | null): ShippingZone {
  const normalizedProvince = normalize(province ?? '');

  if (normalizedProvince === BUENOS_AIRES_NORMALIZED) {
    return partido && AMBA_PARTIDOS_NORMALIZED.has(normalize(partido))
      ? ShippingZone.AMBA
      : ShippingZone.CENTRO;
  }

  return PROVINCE_ZONE_NORMALIZED.get(normalizedProvince) ?? ShippingZone.CENTRO;
}

// Costo por defecto para una zona sin tarifa cargada todavía (no debería
// pasar en producción una vez que el admin cargó la planilla, pero evita
// que el checkout se rompa si falta alguna).
export const DEFAULT_SHIPPING_COST_SUCURSAL = 5000;
export const DEFAULT_SHIPPING_COST_DOMICILIO = 7000;
export const DEFAULT_SHIPPING_DAYS = 7;

// A partir de este monto en productos (sin contar el envío), el envío
// sale gratis sea cual sea el método elegido.
export const FREE_SHIPPING_THRESHOLD = 500000;
