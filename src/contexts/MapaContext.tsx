/**
 * MapaContext — compartilha a última imagem capturada do mapa entre páginas.
 * O Mapa.tsx salva ao capturar; o RelatorioEVM.tsx lê ao gerar o PDF.
 */

import { createContext, useContext, useState, ReactNode } from 'react';

// Tipo inline — evita circular import com exportUtils
export interface MapaCapturada {
  dataUrl: string;
  width: number;
  height: number;
}

interface MapaContextValue {
  mapaCapturado: MapaCapturada | null;
  setMapaCapturado: (img: MapaCapturada | null) => void;
  dataCapturaMap: Date | null;
}

const MapaContext = createContext<MapaContextValue>({
  mapaCapturado: null,
  setMapaCapturado: () => {},
  dataCapturaMap: null,
});

export function MapaProvider({ children }: { children: ReactNode }) {
  const [mapaCapturado, setMapaCapturado] = useState<MapaCapturada | null>(null);
  const [dataCapturaMap, setDataCapturaMap] = useState<Date | null>(null);

  const handleSet = (img: MapaCapturada | null) => {
    setMapaCapturado(img);
    setDataCapturaMap(img ? new Date() : null);
  };

  return (
    <MapaContext.Provider value={{ mapaCapturado, setMapaCapturado: handleSet, dataCapturaMap }}>
      {children}
    </MapaContext.Provider>
  );
}

export function useMapaContext() {
  return useContext(MapaContext);
}