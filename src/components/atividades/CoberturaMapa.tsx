/**
 * CoberturaMapa — Aba "Consulta de Cobertura" dentro de Atividades
 *
 * Funcionalidade:
 * - Seleciona um município do Ceará
 * - Calcula distância por estrada via OSRM para cada sede ativa
 * - Mostra mapa Leaflet com marcadores das sedes e do município selecionado
 * - Destaca a sede mais próxima (recomendada)
 *
 * Sedes ativas: Fortaleza, Sobral, Juazeiro do Norte, Tauá, Crateús, Iguatu
 * Quixadá: aparece no mapa mas COMENTADO na lógica de recomendação
 * (descomentar quando Quixadá tiver unidade móvel operacional)
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { municipiosCeara } from '@/data/municipios';
import { useAtividades } from '@/hooks/useAtividades';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MapPin, Navigation, Loader2, AlertCircle, CheckCircle2,
  Building2, Route, Info, History, Calendar,
} from 'lucide-react';

// ── Coordenadas das sedes ──────────────────────────────────────────────────────
interface Sede {
  nome: string;
  lat: number;
  lng: number;
  cor: string;
  corHex: string;
  ativa: boolean; // false = sem unidade móvel (comentado na recomendação)
}

const SEDES: Sede[] = [
  { nome: 'Fortaleza',         lat: -3.7172,  lng: -38.5433, cor: 'text-teal-700',   corHex: '#0d9488', ativa: true  },
  { nome: 'Sobral',            lat: -3.6861,  lng: -40.3522, cor: 'text-blue-700',   corHex: '#2563eb', ativa: true  },
  { nome: 'Juazeiro do Norte', lat: -7.2136,  lng: -39.3153, cor: 'text-violet-700', corHex: '#7c3aed', ativa: true  },
  { nome: 'Tauá',              lat: -6.0028,  lng: -40.2944, cor: 'text-emerald-700',corHex: '#047857', ativa: false  },
  { nome: 'Crateús',           lat: -5.1778,  lng: -40.6731, cor: 'text-orange-700', corHex: '#c2410c', ativa: false  },
  { nome: 'Iguatu',            lat: -6.3594,  lng: -39.2983, cor: 'text-cyan-700',   corHex: '#0e7490', ativa: false  },
  // Quixadá: sem unidade móvel ainda — manter comentado até ativação
  // { nome: 'Quixadá', lat: -4.9739, lng: -39.0142, cor: 'text-amber-700', corHex: '#d97706', ativa: true },
  { nome: 'Quixadá',           lat: -4.9739,  lng: -39.0142, cor: 'text-amber-700',  corHex: '#d97706', ativa: false },
];

// ── Coordenadas dos 184 municípios do Ceará ───────────────────────────────────
// Fonte: IBGE / OpenStreetMap
export const MUNICIPIOS_COORDS: Record<string, [number, number]> = {
  "Abaiara": [-7.3456, -39.0425], "Acarape": [-4.2228, -38.7056], "Acaraú": [-2.8856, -40.1200],
  "Acopiara": [-6.0939, -39.4528], "Aiuaba": [-6.5739, -40.1231], "Alcântaras": [-3.5578, -40.5503],
  "Altaneira": [-7.0006, -39.3267], "Alto Santo": [-5.5128, -38.2700], "Amontada": [-3.3667, -39.8333],
  "Antonina do Norte": [-6.7689, -39.9822], "Apuiarés": [-3.9456, -39.4317], "Aquiraz": [-3.9006, -38.3914],
  "Aracati": [-4.5617, -37.7697], "Aracoiaba": [-4.3728, -38.8142], "Ararendá": [-4.7378, -40.8317],
  "Araripe": [-7.2100, -40.1431], "Aratuba": [-4.4167, -38.9833], "Arneiroz": [-6.3556, -40.1594],
  "Assaré": [-6.8706, -39.8739], "Aurora": [-6.9433, -38.9739], "Baixio": [-6.6806, -38.5978],
  "Banabuiú": [-5.3078, -38.9167], "Barbalha": [-7.3100, -39.2994], "Barreira": [-4.2867, -38.6428],
  "Barro": [-7.1778, -38.7833], "Barroquinha": [-3.0189, -41.1353], "Baturité": [-4.3289, -38.8839],
  "Beberibe": [-4.1806, -38.1278], "Bela Cruz": [-3.0489, -40.1667], "Boa Viagem": [-5.1178, -39.7331],
  "Brejo Santo": [-7.4906, -38.9853], "Camocim": [-2.9028, -40.8431], "Campos Sales": [-7.0728, -40.3708],
  "Canindé": [-4.3578, -39.3144], "Capistrano": [-4.4628, -38.9139], "Caridade": [-4.2239, -39.1944],
  "Cariré": [-3.9478, -40.4681], "Caririaçu": [-7.0406, -39.2833], "Cariús": [-6.5228, -39.4917],
  "Carnaubal": [-4.1650, -40.9367], "Cascavel": [-4.1317, -38.2381], "Catarina": [-6.1278, -39.8808],
  "Catunda": [-4.6428, -40.2000], "Caucaia": [-3.7339, -38.6531], "Cedro": [-6.5978, -39.0597],
  "Chaval": [-3.0317, -41.2431], "Choró": [-4.8456, -39.1367], "Chorozinho": [-4.2928, -38.4961],
  "Coreaú": [-3.5428, -40.6583], "Crateús": [-5.1778, -40.6731], "Crato": [-7.2339, -39.4094],
  "Croatá": [-4.4167, -40.9000], "Cruz": [-2.9128, -40.1708], "Deputado Irapuan Pinheiro": [-5.9028, -39.2750],
  "Ererê": [-5.7317, -38.3633], "Eusébio": [-3.8900, -38.4531], "Farias Brito": [-6.9267, -39.5681],
  "Forquilha": [-3.7978, -40.2611], "Fortaleza": [-3.7172, -38.5433], "Fortim": [-4.4528, -37.7972],
  "Frecheirinha": [-3.7578, -40.8194], "General Sampaio": [-4.0489, -39.4578], "Graça": [-4.0539, -40.7508],
  "Granja": [-3.1194, -40.8261], "Granjeiro": [-6.8817, -39.2100], "Groaíras": [-3.9228, -40.3619],
  "Guaiúba": [-4.0417, -38.6322], "Guaraciaba do Norte": [-4.1667, -40.7500], "Guaramiranga": [-4.2750, -38.9278],
  "Hidrolândia": [-4.9406, -40.4425], "Horizonte": [-4.1003, -38.4936], "Ibaretama": [-5.1917, -38.7597],
  "Ibiapina": [-3.9278, -40.8917], "Ibicuitinga": [-5.0667, -38.6500], "Icapuí": [-4.7178, -37.3619],
  "Icó": [-6.4028, -38.8608], "Iguatu": [-6.3594, -39.2983], "Independência": [-5.3928, -40.3100],
  "Ipaporanga": [-4.8917, -40.7994], "Ipaumirim": [-6.7928, -38.7156], "Ipu": [-4.3178, -40.7097],
  "Ipueiras": [-4.5406, -40.7136], "Iracema": [-5.8178, -38.3931], "Irauçuba": [-3.7428, -39.7817],
  "Itaiçaba": [-4.9117, -37.8467], "Itaitinga": [-3.9703, -38.5275], "Itapajé": [-3.6878, -39.5836],
  "Itapipoca": [-3.4939, -39.5783], "Itapiúna": [-4.5528, -38.9281], "Itarema": [-2.9217, -39.9153],
  "Itatira": [-4.5228, -39.6178], "Jaguaretama": [-5.6156, -38.7594], "Jaguaribara": [-5.3978, -38.6231],
  "Jaguaribe": [-5.8917, -38.6217], "Jaguaruana": [-4.8339, -37.7817], "Jardim": [-7.5817, -39.2919],
  "Jati": [-7.7028, -39.0008], "Jijoca de Jericoacoara": [-2.7939, -40.5139], "Juazeiro do Norte": [-7.2136, -39.3153],
  "Jucás": [-6.5167, -39.5167], "Lavras da Mangabeira": [-6.7528, -38.9728], "Limoeiro do Norte": [-5.1456, -38.0994],
  "Madalena": [-4.8556, -39.5772], "Maracanaú": [-3.8739, -38.6267], "Maranguape": [-3.8917, -38.6817],
  "Marco": [-3.1556, -40.1481], "Martinópole": [-3.2228, -40.6897], "Massapê": [-3.5239, -40.3417],
  "Mauriti": [-7.3817, -38.7708], "Meruoca": [-3.5378, -40.4550], "Milagres": [-7.3039, -38.9364],
  "Milhã": [-5.6617, -39.1897], "Miraíma": [-3.5667, -39.9167], "Missão Velha": [-7.2456, -39.1417],
  "Mombaça": [-5.7417, -39.6278], "Monsenhor Tabosa": [-4.7850, -40.0631], "Morada Nova": [-5.1072, -38.3731],
  "Moraújo": [-3.4606, -40.6783], "Morrinhos": [-3.2417, -40.1256], "Mucambo": [-3.9056, -40.7467],
  "Mulungu": [-4.3056, -38.9928], "Nova Olinda": [-7.0806, -39.6750], "Nova Russas": [-4.7072, -40.5622],
  "Novo Oriente": [-5.5306, -40.7750], "Ocara": [-4.4861, -38.5828], "Orós": [-6.2456, -38.9083],
  "Pacajus": [-4.1717, -38.4608], "Pacatuba": [-3.9800, -38.6122], "Pacoti": [-4.2228, -38.9228],
  "Pacujá": [-3.9878, -40.6978], "Palhano": [-4.7367, -37.9478], "Palmácia": [-4.1453, -38.8483],
  "Paracuru": [-3.4078, -39.0322], "Paraipaba": [-3.4378, -39.1486], "Parambu": [-6.2039, -40.6894],
  "Paramoti": [-4.0978, -39.2461], "Pedra Branca": [-5.4528, -39.7153], "Penaforte": [-7.8228, -39.0219],
  "Pentecoste": [-3.7883, -39.2714], "Pereiro": [-6.0378, -38.4611], "Pindoretama": [-4.0133, -38.3106],
  "Piquet Carneiro": [-5.7928, -39.4139], "Pires Ferreira": [-4.2406, -40.6456], "Poranga": [-4.7456, -40.9244],
  "Porteiras": [-7.5428, -39.0928], "Potengi": [-7.0856, -40.0178], "Potiretama": [-5.6617, -38.4178],
  "Quiterianópolis": [-5.9917, -40.6611], "Quixadá": [-4.9739, -39.0142], "Quixelô": [-6.2528, -39.1839],
  "Quixeramobim": [-5.1972, -39.2878], "Quixeré": [-5.0728, -37.9806], "Redenção": [-4.2278, -38.7275],
  "Reriutaba": [-4.1428, -40.5758], "Russas": [-4.9406, -37.9747], "Saboeiro": [-6.5328, -39.9097],
  "Salitre": [-7.2878, -40.4681], "Santa Quitéria": [-4.3281, -40.1522], "Santana do Acaraú": [-3.4606, -40.2103],
  "Santana do Cariri": [-7.1833, -39.7361], "São Benedito": [-4.0467, -40.8683], "São Gonçalo do Amarante": [-3.6039, -38.9728],
  "São João do Jaguaribe": [-5.2717, -38.2639], "São Luís do Curu": [-3.6717, -39.2328], "Senador Pompeu": [-5.5828, -39.3619],
  "Senador Sá": [-3.3556, -40.4883], "Sobral": [-3.6861, -40.3522], "Solonópole": [-5.7317, -39.0000],
  "Tabuleiro do Norte": [-5.2489, -38.0817], "Tamboril": [-5.0956, -40.3183], "Tarrafas": [-6.6933, -39.7833],
  "Tauá": [-6.0028, -40.2944], "Tejuçuoca": [-3.9883, -39.5792], "Tianguá": [-3.7294, -40.9919],
  "Trairi": [-3.2778, -39.2689], "Tururu": [-3.6572, -39.4711], "Ubajara": [-3.8539, -40.9194],
  "Umari": [-6.6528, -38.7178], "Umirim": [-3.6828, -39.3458], "Uruburetama": [-3.6328, -39.5139],
  "Uruoca": [-3.3128, -40.5483], "Varjota": [-4.1939, -40.4761], "Várzea Alegre": [-6.7939, -39.2994],
  "Viçosa do Ceará": [-3.5639, -41.0919],
};

// ── Resultado OSRM ─────────────────────────────────────────────────────────────
interface DistanciaResult {
  sede: Sede;
  distanciaKm: number;
  duracaoMin: number;
  status: 'ok' | 'erro';
}

// ── Busca distância via OSRM ───────────────────────────────────────────────────
async function buscarDistanciaOSRM(
  origemLat: number, origemLng: number,
  destinoLat: number, destinoLng: number,
): Promise<{ distanciaKm: number; duracaoMin: number }> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origemLng},${origemLat};${destinoLng},${destinoLat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM indisponível');
  const json = await res.json();
  if (json.code !== 'Ok' || !json.routes?.length) throw new Error('Rota não encontrada');
  return {
    distanciaKm: Math.round(json.routes[0].distance / 1000),
    duracaoMin: Math.round(json.routes[0].duration / 60),
  };
}

// ── Ícone personalizado para Leaflet ──────────────────────────────────────────
function criarIcone(cor: string, tamanho = 36, borda = '#fff') {
  return L.divIcon({
    html: `<div style="
      width:${tamanho}px;height:${tamanho}px;border-radius:50%;
      background:${cor};border:3px solid ${borda};
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
    "><svg width="16" height="16" viewBox="0 0 24 24" fill="white">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg></div>`,
    className: '',
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
  });
}

// ── Componente que ajusta o zoom do mapa ──────────────────────────────────────
function FitBounds({ pontos }: { pontos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length < 2) return;
    const bounds = L.latLngBounds(pontos.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
  }, [pontos, map]);
  return null;
}

// ── Componente principal ───────────────────────────────────────────────────────
export function CoberturaMapa() {
  const { atividades } = useAtividades();
  const { equipamentos } = useEquipamentos();
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string>('');
  const [inputValue, setInputValue] = useState<string>('');
  const [sugestoes, setSugestoes] = useState<string[]>([]);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [resultados, setResultados] = useState<DistanciaResult[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const coordsMunicipio = municipioSelecionado ? MUNICIPIOS_COORDS[municipioSelecionado] : null;

  // Histórico de atividades do município selecionado
  // Equipamentos do município selecionado (DDM, Sala em Delegacia, etc.)
  const equipamentosMunicipio = useMemo(
    () => municipioSelecionado
      ? equipamentos.filter(e => e.municipio === municipioSelecionado)
      : [],
    [equipamentos, municipioSelecionado]
  );

  const historicoMunicipio = municipioSelecionado
    ? atividades
        .filter(a => a.municipio === municipioSelecionado && a.status === 'Realizado')
        .sort((a, b) => new Date(b.data + 'T00:00:00').getTime() - new Date(a.data + 'T00:00:00').getTime())
    : [];
  const totalAtendimentosMunicipio = historicoMunicipio.reduce((s, a) => s + (a.atendimentos ?? 0), 0);
  const ultimaVisita = historicoMunicipio[0] ?? null;

  // Sedes que participam da recomendação (ativas)
  const sedesAtivas = SEDES.filter(s => s.ativa);
  // Todas as sedes (inclusive inativas) para exibir no mapa
  const todasSedes = SEDES;

  const buscarDistancias = useCallback(async () => {
    if (!municipioSelecionado || !coordsMunicipio) return;
    setCarregando(true);
    setErro(null);
    setResultados([]);

    const [origemLat, origemLng] = coordsMunicipio;

    const promises = sedesAtivas.map(async (sede): Promise<DistanciaResult> => {
      try {
        const { distanciaKm, duracaoMin } = await buscarDistanciaOSRM(
          origemLat, origemLng, sede.lat, sede.lng,
        );
        return { sede, distanciaKm, duracaoMin, status: 'ok' };
      } catch {
        // Fallback para distância em linha reta se OSRM falhar
        const R = 6371;
        const dLat = ((sede.lat - origemLat) * Math.PI) / 180;
        const dLon = ((sede.lng - origemLng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((origemLat * Math.PI) / 180) *
          Math.cos((sede.lat * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
        const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        return { sede, distanciaKm: distKm, duracaoMin: Math.round(distKm / 60 * 60), status: 'erro' };
      }
    });

    const res = await Promise.all(promises);
    setResultados(res.sort((a, b) => a.distanciaKm - b.distanciaKm));
    setCarregando(false);
  }, [municipioSelecionado, coordsMunicipio, sedesAtivas]);

  // Versão parametrizada — usada pelo auto-calcular do autocomplete
  const buscarDistanciasParaMunicipio = useCallback(async (municipio: string) => {
    if (!municipio) return;
    const coords = MUNICIPIOS_COORDS[municipio];
    if (!coords) return;
    // Atualiza estado e dispara busca manualmente
    setMunicipioSelecionado(municipio);
    setCarregando(true);
    setErro(null);
    setResultados([]);
    const ativas = SEDES.filter(s => s.ativa);
    const [origemLat, origemLng] = coords;
    const promises = ativas.map(async (sede): Promise<DistanciaResult> => {
      try {
        const { distanciaKm, duracaoMin } = await buscarDistanciaOSRM(origemLat, origemLng, sede.lat, sede.lng);
        return { sede, distanciaKm, duracaoMin, status: 'ok' };
      } catch {
        const R = 6371;
        const dLat = ((sede.lat - origemLat) * Math.PI) / 180;
        const dLon = ((sede.lng - origemLng) * Math.PI) / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos((origemLat*Math.PI)/180)*Math.cos((sede.lat*Math.PI)/180)*Math.sin(dLon/2)**2;
        const distKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
        return { sede, distanciaKm: distKm, duracaoMin: Math.round(distKm/60*60), status: 'erro' };
      }
    });
    const res = await Promise.all(promises);
    setResultados(res.sort((a, b) => a.distanciaKm - b.distanciaKm));
    setCarregando(false);
  }, []);

  const recomendada = resultados.find(r => r.status === 'ok') ?? resultados[0];

  // Pontos para fitBounds: município + sedes ativas
  const pontosMapa: [number, number][] = [
    ...(coordsMunicipio ? [coordsMunicipio] : []),
    ...sedesAtivas.map(s => [s.lat, s.lng] as [number, number]),
  ];

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho informativo ── */}
      <div className="bg-violet-500/5 border border-violet-500/20 rounded-xl p-4 flex gap-3">
        <Info className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
        <div className="text-sm text-violet-800 dark:text-violet-300">
          <p className="font-semibold mb-0.5">Como funciona</p>
          <p className="text-violet-700 dark:text-violet-400 text-xs leading-relaxed">
            Selecione o município que precisa de atendimento. O sistema calcula a distância por estrada
            (via OpenStreetMap) até cada CMB/CMC com unidade móvel ativa e recomenda a mais próxima.
            Sedes ativas: Fortaleza, Sobral, Juazeiro do Norte. Tauá, Crateús, Iguatu e Quixadá será ativada futuramente.
          </p>
        </div>
      </div>

      {/* ── Seleção e busca ── */}
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => {
                const v = e.target.value;
                setInputValue(v);
                if (v.length >= 2) {
                  const matches = municipiosCeara.filter(m =>
                    m.toLowerCase().includes(v.toLowerCase())
                  ).slice(0, 8);
                  setSugestoes(matches);
                  setShowSugestoes(true);
                } else {
                  setSugestoes([]);
                  setShowSugestoes(false);
                }
                // Se o texto não bate exatamente com nenhum município, limpa a seleção
                if (!municipiosCeara.includes(v)) setMunicipioSelecionado('');
              }}
              onFocus={() => {
                if (sugestoes.length > 0) setShowSugestoes(true);
              }}
              onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
              placeholder="Digite o nome do município a ser atendido..."
              className="w-full h-11 pl-9 pr-4 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            {inputValue && (
              <button
                onClick={() => { setInputValue(''); setMunicipioSelecionado(''); setSugestoes([]); setShowSugestoes(false); setResultados([]); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>
          {/* Dropdown de sugestões */}
          {showSugestoes && sugestoes.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {sugestoes.map(m => (
                <button
                  key={m}
                  onMouseDown={() => {
                    setInputValue(m);
                    setSugestoes([]);
                    setShowSugestoes(false);
                    // Calcular automaticamente ao selecionar
                    buscarDistanciasParaMunicipio(m);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-muted transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  {/* Destacar o trecho digitado */}
                  {(() => {
                    const idx = m.toLowerCase().indexOf(inputValue.toLowerCase());
                    if (idx === -1) return m;
                    return (
                      <>
                        {m.slice(0, idx)}
                        <span className="font-semibold text-primary">{m.slice(idx, idx + inputValue.length)}</span>
                        {m.slice(idx + inputValue.length)}
                      </>
                    );
                  })()}
                </button>
              ))}
            </div>
          )}
          {/* Confirmação do município selecionado */}
          {municipioSelecionado && (
            <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {municipioSelecionado} selecionado
            </p>
          )}
        </div>
        <Button
          onClick={buscarDistancias}
          disabled={!municipioSelecionado || carregando}
          className="h-11 px-6 gap-2 self-start"
        >
          {carregando
            ? <><Loader2 className="w-4 h-4 animate-spin" />Calculando...</>
            : <><Route className="w-4 h-4" />Calcular Distâncias</>
          }
        </Button>
      </div>

      {/* ── Layout: mapa + resultados ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Mapa */}
        <div className="lg:col-span-2">
          <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden" style={{ height: 480 }}>
            <MapContainer
              center={[-5.2, -39.5]}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Ajusta zoom */}
              {resultados.length > 0 && coordsMunicipio && (
                <FitBounds pontos={pontosMapa} />
              )}

              {/* Marcador do município selecionado */}
              {coordsMunicipio && (
                <Marker
                  position={coordsMunicipio}
                  icon={criarIcone('#1f2937', 40, '#fff')}
                >
                  <Popup>
                    <div className="text-sm font-semibold">{municipioSelecionado}</div>
                    <div className="text-xs text-gray-500">Município solicitante</div>
                  </Popup>
                </Marker>
              )}

              {/* Marcadores das sedes */}
              {todasSedes.map(sede => {
                const resultado = resultados.find(r => r.sede.nome === sede.nome);
                const ehRecomendada = recomendada?.sede.nome === sede.nome;
                return (
                  <Marker
                    key={sede.nome}
                    position={[sede.lat, sede.lng]}
                    icon={criarIcone(
                      sede.ativa ? sede.corHex : '#9ca3af',
                      ehRecomendada ? 44 : 36,
                      ehRecomendada ? '#ffd700' : '#fff',
                    )}
                  >
                    <Popup>
                      <div className="text-sm font-semibold">{sede.nome}</div>
                      {!sede.ativa && (
                        <div className="text-xs text-amber-600 mt-0.5">⚠️ Sem unidade móvel ainda</div>
                      )}
                      {resultado && (
                        <div className="text-xs text-gray-600 mt-1">
                          <div>{resultado.distanciaKm} km por estrada</div>
                          <div>{resultado.duracaoMin} min estimados</div>
                          {resultado.status === 'erro' && <div className="text-amber-500">* distância aproximada</div>}
                        </div>
                      )}
                      {ehRecomendada && resultado && (
                        <div className="text-xs font-semibold text-emerald-600 mt-1">✓ Sede recomendada</div>
                      )}
                    </Popup>
                  </Marker>
                );
              })}

              {/* Linhas conectando município às sedes ativas */}
              {coordsMunicipio && resultados.map(r => (
                <Polyline
                  key={r.sede.nome}
                  positions={[coordsMunicipio, [r.sede.lat, r.sede.lng]]}
                  pathOptions={{
                    color: recomendada?.sede.nome === r.sede.nome ? r.sede.corHex : '#9ca3af',
                    weight: recomendada?.sede.nome === r.sede.nome ? 3 : 1.5,
                    dashArray: recomendada?.sede.nome === r.sede.nome ? undefined : '6 4',
                    opacity: recomendada?.sede.nome === r.sede.nome ? 0.9 : 0.4,
                  }}
                />
              ))}
            </MapContainer>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            ★ Sede recomendada destacada em dourado · Linhas tracejadas = alternativas
          </p>
        </div>

        {/* Painel de resultados */}
        <div className="space-y-3">

          {/* Estado inicial */}
          {!municipioSelecionado && (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground h-full flex flex-col items-center justify-center gap-3">
              <MapPin className="w-10 h-10 opacity-20" />
              <p className="text-sm font-medium">Selecione um município</p>
              <p className="text-xs opacity-70">para calcular a unidade móvel mais próxima</p>
            </div>
          )}

          {/* Município selecionado mas sem calcular ainda — mostra histórico imediatamente */}
          {municipioSelecionado && !carregando && resultados.length === 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-xl border p-4',
                historicoMunicipio.length > 0 ? 'bg-violet-500/5 border-violet-500/20' : 'bg-muted/30 border-border'
              )}
            >
              {/* Equipamentos cadastrados no município */}
              {equipamentosMunicipio.length > 0 && (
                <div className="mb-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Equipamentos cadastrados</p>
                  {equipamentosMunicipio.map(e => {
                    const isPolicia = e.tipo === 'DDM' || e.tipo === 'Sala Lilás em Delegacia';
                    return (
                      <div key={e.id} className={cn(
                        'flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg',
                        isPolicia ? 'bg-green-500/10 text-green-800' : 'bg-primary/10 text-primary'
                      )}>
                        <Building2 className="w-3 h-3 shrink-0" />
                        <span className="font-medium">{e.tipo}</span>
                        {e.possui_patrulha && <span className="ml-auto text-cyan-600 font-medium">+ Patrulha M.P.</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-violet-600" />
                <p className="font-semibold text-sm">Histórico — {municipioSelecionado}</p>
              </div>
              {historicoMunicipio.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma atividade realizada neste município ainda.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-violet-700">{historicoMunicipio.length}</p>
                      <p className="text-[10px] text-muted-foreground">visitas realizadas</p>
                    </div>
                    <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                      <p className="text-xl font-bold text-violet-700">{totalAtendimentosMunicipio.toLocaleString('pt-BR')}</p>
                      <p className="text-[10px] text-muted-foreground">pessoas atendidas</p>
                    </div>
                  </div>
                  {ultimaVisita && (
                    <div className="flex items-start gap-2 p-2 bg-white/40 dark:bg-card/40 rounded-lg">
                      <Calendar className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-medium text-violet-700">Última visita</p>
                        <p className="text-xs font-bold">
                          {format(new Date(ultimaVisita.data + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {ultimaVisita.tipo} · {ultimaVisita.municipio_sede}
                          {ultimaVisita.atendimentos ? ` · ${ultimaVisita.atendimentos} atendimentos` : ''}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
              <p className="text-xs text-muted-foreground mt-3 italic text-center">
                Clique em "Calcular Distâncias" para ver a sede recomendada
              </p>
            </motion.div>
          )}

          {/* Carregando */}
          {carregando && (
            <div className="bg-card rounded-xl border border-border p-6 text-center h-full flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-primary opacity-60" />
              <p className="text-sm font-medium">Calculando distâncias...</p>
              <p className="text-xs text-muted-foreground">Consultando rotas via OpenStreetMap</p>
            </div>
          )}

          {/* Resultados */}
          <AnimatePresence>
            {!carregando && resultados.length > 0 && (
              <>
                {/* Card da recomendada */}
                {recomendada && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <p className="font-semibold text-sm text-emerald-700">Sede Recomendada</p>
                    </div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: recomendada.sede.corHex }} />
                      <p className="font-bold text-lg">{recomendada.sede.nome}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                        <p className="text-2xl font-bold text-emerald-700">{recomendada.distanciaKm}</p>
                        <p className="text-xs text-muted-foreground">km por estrada</p>
                      </div>
                      <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                        <p className="text-2xl font-bold text-emerald-700">
                          {recomendada.duracaoMin >= 60
                            ? `${Math.floor(recomendada.duracaoMin / 60)}h${recomendada.duracaoMin % 60 > 0 ? recomendada.duracaoMin % 60 + 'm' : ''}`
                            : `${recomendada.duracaoMin}m`}
                        </p>
                        <p className="text-xs text-muted-foreground">tempo estimado</p>
                      </div>
                    </div>
                    {recomendada.status === 'erro' && (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Distância aproximada (OSRM indisponível)
                      </p>
                    )}
                  </motion.div>
                )}

                {/* Ranking das demais */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Navigation className="w-4 h-4 text-muted-foreground" />
                    <p className="font-semibold text-sm">Todas as Opções</p>
                  </div>
                  <div className="space-y-2">
                    {resultados.map((r, i) => (
                      <div
                        key={r.sede.nome}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                          i === 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-transparent',
                        )}
                      >
                        <span className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                          i === 0 ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
                        )}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.sede.corHex }} />
                            <p className="font-medium text-sm truncate">{r.sede.nome}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {r.distanciaKm} km ·{' '}
                            {r.duracaoMin >= 60
                              ? `${Math.floor(r.duracaoMin / 60)}h${r.duracaoMin % 60 > 0 ? r.duracaoMin % 60 + 'm' : ''}`
                              : `${r.duracaoMin} min`}
                            {r.status === 'erro' && ' (aprox.)'}
                          </p>
                        </div>
                        {i === 0 && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                      </div>
                    ))}

                    {/* Quixadá — inativa, aparece separado */}
                    {(() => {
                      const quixada = SEDES.find(s => s.nome === 'Quixadá');
                      if (!quixada) return null;
                      return (
                        <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-amber-300/50 bg-amber-50/30 dark:bg-amber-900/10 opacity-60">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-100 shrink-0">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-amber-400" />
                              <p className="font-medium text-sm">Quixadá</p>
                            </div>
                            <p className="text-xs text-amber-600 mt-0.5">Sem unidade móvel ativa</p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>

                {/* Card do município */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="bg-card rounded-xl border border-border p-4"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <p className="font-semibold text-sm">Município Solicitante</p>
                  </div>
                  <p className="font-bold text-base mt-2">{municipioSelecionado}</p>
                  {coordsMunicipio && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {coordsMunicipio[0].toFixed(4)}°, {coordsMunicipio[1].toFixed(4)}°
                    </p>
                  )}
                </motion.div>

                {/* Histórico de atendimentos */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className={cn(
                    'rounded-xl border p-4',
                    historicoMunicipio.length > 0
                      ? 'bg-violet-500/5 border-violet-500/20'
                      : 'bg-muted/30 border-border'
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <History className="w-4 h-4 text-violet-600" />
                    <p className="font-semibold text-sm">Histórico de Atendimentos</p>
                  </div>
                  {historicoMunicipio.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma atividade realizada neste município ainda.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-violet-700">{historicoMunicipio.length}</p>
                          <p className="text-[10px] text-muted-foreground">visitas realizadas</p>
                        </div>
                        <div className="bg-white/60 dark:bg-card/60 rounded-lg p-2 text-center">
                          <p className="text-xl font-bold text-violet-700">{totalAtendimentosMunicipio.toLocaleString('pt-BR')}</p>
                          <p className="text-[10px] text-muted-foreground">pessoas atendidas</p>
                        </div>
                      </div>
                      {ultimaVisita && (
                        <div className="flex items-start gap-2 p-2 bg-white/40 dark:bg-card/40 rounded-lg">
                          <Calendar className="w-3.5 h-3.5 text-violet-500 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[11px] font-medium text-violet-700">Última visita</p>
                            <p className="text-xs font-bold">
                              {format(new Date(ultimaVisita.data + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {ultimaVisita.tipo} · {ultimaVisita.municipio_sede}
                              {ultimaVisita.atendimentos ? ` · ${ultimaVisita.atendimentos} atendimentos` : ''}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Últimas 3 visitas */}
                      {historicoMunicipio.length > 1 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-[10px] text-muted-foreground font-medium">Visitas anteriores:</p>
                          {historicoMunicipio.slice(1, 4).map((a) => (
                            <div key={a.id} className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>{format(new Date(a.data + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                              <span>{a.tipo}</span>
                              <span>{a.atendimentos ? `${a.atendimentos} atend.` : '—'}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}