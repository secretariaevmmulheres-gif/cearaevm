/**
 * MapaContext — compartilha dados do mapa entre páginas.
 *
 * O Mapa.tsx popula geoJsonData, municipioColors, mapaStats e mapaEquipmentCounts
 * automaticamente ao carregar.
 * O RelatorioEVM.tsx lê esses dados para gerar a página vetorial do PDF — sem
 * precisar fazer fetch próprio nem recalcular cores.
 */

import { createContext, useContext, useState, ReactNode } from 'react';
import type { FeatureCollection } from 'geojson';
import type { MapExportStats, MapEquipmentCounts } from '@/lib/exportUtils';

export interface MapaCapturada {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Cores dos municípios: normalizedName → hexColor.
 * Usamos Record em vez de Map<> para evitar conflito com o global Map do JS.
 */
export type MunicipioColorsRecord = Record<string, string>;

interface MapaContextValue {
  mapaCapturado:    MapaCapturada | null;
  setMapaCapturado: (img: MapaCapturada | null) => void;
  dataCapturaMap:   Date | null;

  geoJsonData:           FeatureCollection | null;
  setGeoJsonData:        (data: FeatureCollection | null) => void;

  municipioColors:       MunicipioColorsRecord;
  setMunicipioColors:    (c: MunicipioColorsRecord) => void;

  mapaStats:             MapExportStats | null;
  setMapaStats:          (s: MapExportStats | null) => void;

  mapaEquipmentCounts:   MapEquipmentCounts | null;
  setMapaEquipmentCounts:(c: MapEquipmentCounts | null) => void;
}

const MapaContext = createContext<MapaContextValue>({
  mapaCapturado: null, setMapaCapturado: () => {}, dataCapturaMap: null,
  geoJsonData: null, setGeoJsonData: () => {},
  municipioColors: {}, setMunicipioColors: () => {},
  mapaStats: null, setMapaStats: () => {},
  mapaEquipmentCounts: null, setMapaEquipmentCounts: () => {},
});

export function MapaProvider({ children }: { children: ReactNode }) {
  const [mapaCapturado,       setMapaCapturadoState] = useState<MapaCapturada | null>(null);
  const [dataCapturaMap,      setDataCapturaMap]      = useState<Date | null>(null);
  const [geoJsonData,         setGeoJsonData]         = useState<FeatureCollection | null>(null);
  const [municipioColors,     setMunicipioColors]     = useState<MunicipioColorsRecord>({});
  const [mapaStats,           setMapaStats]           = useState<MapExportStats | null>(null);
  const [mapaEquipmentCounts, setMapaEquipmentCounts] = useState<MapEquipmentCounts | null>(null);

  const setMapaCapturado = (img: MapaCapturada | null) => {
    setMapaCapturadoState(img);
    setDataCapturaMap(img ? new Date() : null);
  };

  return (
    <MapaContext.Provider value={{
      mapaCapturado, setMapaCapturado, dataCapturaMap,
      geoJsonData, setGeoJsonData,
      municipioColors, setMunicipioColors,
      mapaStats, setMapaStats,
      mapaEquipmentCounts, setMapaEquipmentCounts,
    }}>
      {children}
    </MapaContext.Provider>
  );
}

export function useMapaContext() {
  return useContext(MapaContext);
}