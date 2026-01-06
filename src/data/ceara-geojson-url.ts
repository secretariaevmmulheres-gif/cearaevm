// GeoJSON URL for Ceará municipalities from IBGE
export const CEARA_GEOJSON_URL = 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-23-mun.json';

// Municipality name normalization to match database names with GeoJSON names
export const municipioNameMap: Record<string, string> = {
  // GeoJSON names that differ from our list
  "Deputado Irapuan Pinheiro": "Deputado Irapuã Pinheiro",
  "Itapagé": "Itapajé",
};

export function normalizeMunicipioName(name: string): string {
  return municipioNameMap[name] || name;
}
