import { useMemo } from 'react';
import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { useAtividades } from '@/hooks/useAtividades';
import { getRegiao } from '@/data/municipios';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Regiões do PPA ────────────────────────────────────────────────────────────
export const REGIOES_PPA = [
  'Cariri','Centro Sul','Grande Fortaleza','Litoral Leste','Litoral Norte',
  'Litoral Oeste/Vale do Curu','Maciço do Baturité','Serra da Ibiapaba',
  'Sertão Central','Sertão de Canindé','Sertão de Crateús','Sertão de Sobral',
  'Sertão dos Inhamuns','Vale do Jaguaribe',
] as const;

export type RegiaoPPA = typeof REGIOES_PPA[number];

export const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
] as const;
export type Mes = typeof MESES[number];

const REGIAO_MAP: Record<string, RegiaoPPA> = {
  'Cariri':'Cariri','Centro Sul':'Centro Sul','Grande Fortaleza':'Grande Fortaleza',
  'Litoral Leste':'Litoral Leste','Litoral Norte':'Litoral Norte',
  'Litoral Oeste/Vale do Curu':'Litoral Oeste/Vale do Curu','Maciço do Baturité':'Maciço do Baturité',
  'Serra da Ibiapaba':'Serra da Ibiapaba','Sertão Central':'Sertão Central',
  'Sertão de Canindé':'Sertão de Canindé','Sertão Crateús':'Sertão de Crateús',
  'Sertão de Crateús':'Sertão de Crateús','Sertão dos Inhamuns':'Sertão dos Inhamuns',
  'Vale do Jaguaribe':'Vale do Jaguaribe','Sertão Sobral':'Sertão de Sobral',
  'Sertão de Sobral':'Sertão de Sobral',
};

export function mapRegiao(municipio: string): RegiaoPPA | null {
  const r = getRegiao(municipio);
  return (r && REGIAO_MAP[r]) || null;
}

export const CMC_REGIOES: Record<string, RegiaoPPA> = {
  'Juazeiro do Norte':'Cariri','Iguatu':'Centro Sul','Quixadá':'Sertão Central',
  'Crateús':'Sertão de Crateús','Sobral':'Sertão de Sobral','Tauá':'Sertão dos Inhamuns',
};

export const CMC_LABEL: Record<string, string> = {
  'Juazeiro do Norte': 'CMC JUAZEIRO',
  'Iguatu':            'CMC IGUATU',
  'Quixadá':           'CMC QUIXADÁ',
  'Crateús':           'CMC CRATEÚS',
  'Sobral':            'CMC SOBRAL',
  'Tauá':              'CMC TAUÁ',
};

function getMes(d: string | null | undefined): Mes | null {
  if (!d) return null;
  try {
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt.getTime()) ? null : MESES[dt.getMonth()] as Mes;
  } catch { return null; }
}

function fmtDataCurta(d: string | null | undefined): string {
  if (!d) return '';
  try { return format(parseISO(d), 'dd/MM', { locale: ptBR }); } catch { return d; }
}

export type TabelaRegiaoPPA = Record<RegiaoPPA, Record<Mes, number>>;

export function emptyTabela(): TabelaRegiaoPPA {
  const t = {} as TabelaRegiaoPPA;
  for (const r of REGIOES_PPA) {
    t[r] = {} as Record<Mes, number>;
    for (const m of MESES) t[r][m] = 0;
  }
  return t;
}

export function totalLinha(row: Record<Mes, number>): number {
  return MESES.reduce((s, m) => s + (row[m] ?? 0), 0);
}

export function totalColuna(tabela: TabelaRegiaoPPA, mes: Mes): number {
  return REGIOES_PPA.reduce((s, r) => s + (tabela[r][mes] ?? 0), 0);
}

export function gerarTextoNarrativoPPA(municipios: string[]): string {
  if (!municipios?.length) return '';
  const porRegiao: Partial<Record<RegiaoPPA, string[]>> = {};
  const semRegiao: string[] = [];
  for (const m of municipios) {
    const r = mapRegiao(m);
    if (r) { if (!porRegiao[r]) porRegiao[r] = []; porRegiao[r]!.push(m); }
    else semRegiao.push(m);
  }
  const partes: string[] = [];
  for (const regiao of REGIOES_PPA) {
    const lista = porRegiao[regiao];
    if (!lista?.length) continue;
    partes.push(`${regiao}: ${lista.length} ${lista.length === 1 ? 'município' : 'municípios'} (${lista.join(', ')})`);
  }
  if (semRegiao.length) partes.push(`Outros: ${semRegiao.join(', ')}`);
  return partes.join('; ');
}

export interface QualificacaoPPA {
  id: string;
  nome_evento: string | null;
  data: string;
  data_fim: string | null;
  sede: string;
  municipios_participantes: string[];
  total_municipios: number;
  texto_narrativo: string;
  mes: Mes | null;
}

// ── Ações Realizadas ──────────────────────────────────────────────────────────
// Estrutura: por mês → por sede → lista de textos
export interface AcaoRealizada {
  id: string;
  data: string;
  data_fim: string | null;
  sede: string;          // 'SEM', 'CMB', 'CMC JUAZEIRO', etc.
  tipo: string;
  nome_evento: string | null;
  observacoes: string | null;
  municipio: string;
  texto: string;         // texto formatado: "dd/MM - Nome do evento"
  mes: Mes | null;
}

export interface ResumoMensal {
  mes: Mes;
  // contadores para a tabela numérica do PPA
  qualificacoes: number;        // col 1 — Qualificações/Capacitações
  atendimentos: number;         // col 2 — Atendimentos CMB+CMC
  unidadesMoveis: number;       // col 3 — Atividades Unidade Móvel
  palestras: number;            // col 4 — Palestras/Eventos
  totalAcoes: number;           // col 5 — Total
  // texto narrativo por sede
  acoesPorSede: Record<string, AcaoRealizada[]>;
  textoNarrativo: string;       // texto completo agregado
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function usePPA(ano: number = 2026) {
  const { equipamentos } = useEquipamentos();
  const { solicitacoes }  = useSolicitacoes();
  const { atividades }    = useAtividades();

  return useMemo(() => {

    // ── 1. Salas Lilás Implantadas ──────────────────────────────────────────
    const salasLilasImplantadas = emptyTabela();
    const salasLilasImplantadasMunicipios: Record<string, string[]> = {};
    MESES.forEach(m => { salasLilasImplantadasMunicipios[m] = []; });
    solicitacoes
      .filter(s => s.status === 'Inaugurada' && s.tipo_equipamento.toLowerCase().includes('sala lilás') &&
        s.data_inauguracao && new Date(s.data_inauguracao + 'T00:00:00').getFullYear() === ano)
      .forEach(s => {
        const regiao = mapRegiao(s.municipio); const mes = getMes(s.data_inauguracao);
        if (!regiao || !mes) return;
        salasLilasImplantadas[regiao][mes]++;
        salasLilasImplantadasMunicipios[mes].push(s.municipio);
      });

    // ── 2. Salas Lilás Mantidas — APENAS Governo do Estado ─────────────────
    const salasLilasMantidas = emptyTabela();
    equipamentos
      .filter(e => e.tipo === 'Sala Lilás Governo do Estado')
      .forEach(e => {
        const regiao = mapRegiao(e.municipio);
        if (!regiao) return;
        MESES.forEach(m => { salasLilasMantidas[regiao][m]++; });
      });

    // ── 3. CMMs Apoiadas ────────────────────────────────────────────────────
    const cmmApoiadas = emptyTabela();
    const cmmApoiadasMunicipios: Record<string, string[]> = {};
    MESES.forEach(m => { cmmApoiadasMunicipios[m] = []; });
    solicitacoes
      .filter(s => s.status === 'Inaugurada' && s.tipo_equipamento === 'Casa da Mulher Municipal' &&
        s.data_inauguracao && new Date(s.data_inauguracao + 'T00:00:00').getFullYear() === ano)
      .forEach(s => {
        const regiao = mapRegiao(s.municipio); const mes = getMes(s.data_inauguracao);
        if (!regiao || !mes) return;
        cmmApoiadas[regiao][mes]++;
        cmmApoiadasMunicipios[mes].push(s.municipio);
      });

    // ── 4. Atendimentos ─────────────────────────────────────────────────────
    const atendCMB: Record<Mes, number> = {} as any;
    MESES.forEach(m => { atendCMB[m] = 0; });
    const atendCMC: Record<string, Record<Mes, number>> = {};
    Object.keys(CMC_REGIOES).forEach(c => {
      atendCMC[c] = {} as Record<Mes, number>;
      MESES.forEach(m => { atendCMC[c][m] = 0; });
    });
    const atendVan = emptyTabela();

    // ── 5. Qualificações ────────────────────────────────────────────────────
    const qualificacoesPPA: QualificacaoPPA[] = [];

    // ── 6. Ações Realizadas ─────────────────────────────────────────────────
    // Todas as atividades do ano, agrupadas por mês e sede
    const atividadesAno = atividades.filter(a =>
      a.data && new Date(a.data + 'T00:00:00').getFullYear() === ano
    );

    // Contadores e ações por mês
    const resumoMensal: Record<Mes, ResumoMensal> = {} as any;
    MESES.forEach(m => {
      resumoMensal[m] = {
        mes: m, qualificacoes: 0, atendimentos: 0, unidadesMoveis: 0, palestras: 0, totalAcoes: 0,
        acoesPorSede: {}, textoNarrativo: '',
      };
    });

    for (const a of atividadesAno) {
      const mes = getMes(a.data);
      if (!mes) continue;
      const rm = resumoMensal[mes];

      // Atendimentos CMB
      if (a.municipio_sede === 'CMB') {
        atendCMB[mes] += a.atendimentos ?? 0;
        rm.atendimentos += a.atendimentos ?? 0;
      }
      // Atendimentos CMC
      if (Object.keys(CMC_REGIOES).includes(a.municipio_sede)) {
        const mes2 = getMes(a.data);
        if (mes2 && atendCMC[a.municipio_sede]) atendCMC[a.municipio_sede][mes2] += a.atendimentos ?? 0;
        rm.atendimentos += a.atendimentos ?? 0;
      }
      // Unidade Móvel
      if (a.tipo === 'Unidade Móvel') {
        const regiao = mapRegiao(a.municipio);
        if (regiao) atendVan[regiao][mes] += a.atendimentos ?? 0;
        rm.unidadesMoveis++;
      }
      // Qualificações
      if (a.tipo === 'Qualificação') {
        rm.qualificacoes++;
        const partic = a.municipios_participantes ?? [];
        if (partic.length > 0) {
          let dataFim: string | null = null;
          if (a.dias && a.dias > 1) {
            const d = new Date(a.data + 'T00:00:00');
            d.setDate(d.getDate() + a.dias - 1);
            dataFim = d.toISOString().split('T')[0];
          }
          qualificacoesPPA.push({
            id: a.id, nome_evento: a.nome_evento, data: a.data, data_fim: dataFim,
            sede: a.municipio_sede, municipios_participantes: partic,
            total_municipios: partic.length,
            texto_narrativo: gerarTextoNarrativoPPA(partic),
            mes,
          });
        }
      }
      // Palestras/Eventos
      if (['Palestra','Evento','Tenda Lilás'].includes(a.tipo)) rm.palestras++;

      rm.totalAcoes++;

      // Montar texto da ação para o narrativo
      const sede = a.municipio_sede || a.municipio;
      if (!rm.acoesPorSede[sede]) rm.acoesPorSede[sede] = [];

      // Formatar data
      let dataLabel = fmtDataCurta(a.data);
      if (a.dias && a.dias > 1) {
        const fim = new Date(a.data + 'T00:00:00');
        fim.setDate(fim.getDate() + a.dias - 1);
        dataLabel += ` e ${fmtDataCurta(fim.toISOString().split('T')[0])}`;
      }

      // Montar texto da ação
      const partes: string[] = [];
      if (dataLabel) partes.push(dataLabel);
      const descricao = a.nome_evento || a.observacoes || a.tipo;
      if (descricao) partes.push(descricao);
      // Municípios participantes de qualificação
      const partic = a.municipios_participantes ?? [];
      if (partic.length > 0) {
        partes.push(`(${gerarTextoNarrativoPPA(partic)})`);
      }

      rm.acoesPorSede[sede].push({
        id: a.id, data: a.data, data_fim: null, sede,
        tipo: a.tipo, nome_evento: a.nome_evento, observacoes: a.observacoes,
        municipio: a.municipio,
        texto: partes.join(' – '),
        mes,
      });
    }

    // Gerar texto narrativo mensal
    const ORDEM_SEDES = ['SEM', 'CMB', ...Object.values(CMC_LABEL)];
    MESES.forEach(m => {
      const rm = resumoMensal[m];
      const partes: string[] = [];
      // Sedes na ordem padrão primeiro
      for (const sede of ORDEM_SEDES) {
        const acoes = rm.acoesPorSede[sede];
        if (!acoes?.length) {
          // CMCs sem ação — registrar explicitamente
          if (sede.startsWith('CMC')) partes.push(`${sede}: NÃO HOUVE AÇÃO`);
          continue;
        }
        partes.push(`${sede}: ${acoes.map(a => a.texto).join('; ')}`);
      }
      // Demais sedes que não estão na ordem padrão
      for (const [sede, acoes] of Object.entries(rm.acoesPorSede)) {
        if (!ORDEM_SEDES.includes(sede) && acoes.length > 0) {
          partes.push(`${sede}: ${acoes.map(a => a.texto).join('; ')}`);
        }
      }
      rm.textoNarrativo = partes.join('\n\n');
    });

    // Qualificações por mês
    qualificacoesPPA.sort((a, b) => a.data.localeCompare(b.data));
    const qualificacoesPorMes: Record<Mes, QualificacaoPPA[]> = {} as any;
    MESES.forEach(m => { qualificacoesPorMes[m] = []; });
    qualificacoesPPA.forEach(q => { if (q.mes) qualificacoesPorMes[q.mes].push(q); });

    return {
      ano,
      salasLilasImplantadas, salasLilasImplantadasMunicipios,
      salasLilasMantidas,
      cmmApoiadas, cmmApoiadasMunicipios,
      atendCMB, atendCMC, atendVan,
      qualificacoesPPA, qualificacoesPorMes,
      resumoMensal,
      totalLinha, totalColuna,
      totalSalasLilasAtivas: equipamentos.filter(e => e.tipo === 'Sala Lilás Governo do Estado').length,
      totalCMMInauguradasAno: solicitacoes.filter(s =>
        s.status === 'Inaugurada' && s.tipo_equipamento === 'Casa da Mulher Municipal' &&
        s.data_inauguracao && new Date(s.data_inauguracao + 'T00:00:00').getFullYear() === ano
      ).length,
      totalSalasLilasInauguradasAno: solicitacoes.filter(s =>
        s.status === 'Inaugurada' && s.tipo_equipamento.toLowerCase().includes('sala lilás') &&
        s.data_inauguracao && new Date(s.data_inauguracao + 'T00:00:00').getFullYear() === ano
      ).length,
      totalMunicipiosQualificados: new Set(
        qualificacoesPPA.flatMap(q => q.municipios_participantes)
      ).size,
    };
  }, [equipamentos, solicitacoes, atividades, ano]);
}