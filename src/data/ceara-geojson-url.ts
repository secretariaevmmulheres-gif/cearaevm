// URL GeoJSON para municípios cearenses do IBGE
export const CEARA_GEOJSON_URL = 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-23-mun.json';

// Normalização dos nomes dos municípios para que correspondam aos nomes no banco de dados com os nomes GeoJSON.
export const municipioNameMap: Record<string, string> = {
  // Nomes GeoJSON que diferem da nossa lista
  "Deputado Irapuan Pinheiro": "Deputado Irapuã Pinheiro",
  "Itapagé": "Itapajé",
};

export function normalizeMunicipioName(name: string): string {
  return municipioNameMap[name] || name;
}
