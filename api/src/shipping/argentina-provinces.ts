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

// Costo por defecto para una provincia sin tarifa cargada todavía (no
// debería pasar en producción una vez que el admin cargó la planilla, pero
// evita que el checkout se rompa si falta una).
export const DEFAULT_SHIPPING_COST_SUCURSAL = 5000;
export const DEFAULT_SHIPPING_COST_DOMICILIO = 7000;
export const DEFAULT_SHIPPING_DAYS = 7;
