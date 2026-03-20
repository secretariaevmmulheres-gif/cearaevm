import { TipoEquipamento, StatusSolicitacao, OrgaoResponsavel } from "@/data/municipios";

export type AppRole = 'admin' | 'editor' | 'viewer' | 'atividades_editor';

// ── Atividades ────────────────────────────────────────────────────────────────
export type TipoAtividade = 'Unidade Móvel' | 'Palestra' | 'Evento' | 'Tenda Lilás' | 'Visita a DDM' | 'Visita a Delegacia' | 'Outro';
export type RecursoAtividade = 'Unidade Móvel' | 'Equipe' | 'Unidade Móvel + Equipe';
export type StatusAtividade = 'Agendado' | 'Realizado' | 'Cancelado';

export interface Atividade {
  id: string;
  municipio: string;
  municipio_sede: string;
  tipo: TipoAtividade;
  recurso: RecursoAtividade;
  quantidade_equipe: number | null;
  status: StatusAtividade;
  nup: string | null;
  nome_evento: string | null;
  data: string;
  dias: number | null;
  horario: string | null;
  atendimentos: number | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Perfil e roles ────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

// ── Equipamentos ──────────────────────────────────────────────────────────────
export interface Equipamento {
  id: string;
  municipio: string;
  tipo: TipoEquipamento;
  possui_patrulha: boolean;
  endereco: string;
  telefone: string;
  responsavel: string;
  observacoes: string;
  kit_athena_entregue: boolean;
  kit_athena_previo: boolean;
  capacitacao_realizada: boolean;
  nup: string | null;
  qualificacao_id: string | null;
  created_at: string;
  updated_at: string;
}

// ── Viaturas ──────────────────────────────────────────────────────────────────
export interface Viatura {
  id: string;
  municipio: string;
  tipo_patrulha: string;
  vinculada_equipamento: boolean;
  equipamento_id?: string;
  orgao_responsavel: OrgaoResponsavel;
  quantidade: number;
  data_implantacao: string;
  responsavel: string;
  observacoes: string;
  created_at: string;
  updated_at: string;
}

// ── Solicitações ──────────────────────────────────────────────────────────────
export interface Solicitacao {
  id: string;
  municipio: string;
  data_solicitacao: string;
  tipo_equipamento: TipoEquipamento;
  status: StatusSolicitacao;
  recebeu_patrulha: boolean;
  guarda_municipal_estruturada: boolean;
  kit_athena_entregue: boolean;
  kit_athena_previo: boolean;
  capacitacao_realizada: boolean;
  nup: string | null;
  qualificacao_id: string | null;
  observacoes: string;
  anexos: string[];
  created_at: string;
  updated_at: string; // usado pelo diagnóstico para calcular dias sem movimento
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export interface DashboardStats {
  totalEquipamentos: number;
  equipamentosPorTipo: Record<TipoEquipamento, number>;
  municipiosComEquipamento: number;
  municipiosSemEquipamento: number;
  equipamentosComPatrulha: number;
  totalViaturas: number;
  viaturasPatrulhasCasas: number;
  viaturasPMCE: number;
  municipiosComViaturaSemEquipamento: number;
  municipiosComViaturaComEquipamento: number;
  viaturasPorOrgao: Record<OrgaoResponsavel, number>;
  totalSolicitacoes: number;
  solicitacoesPorStatus: Record<StatusSolicitacao, number>;
  solicitacoesPorTipo: Record<TipoEquipamento, number>;
}