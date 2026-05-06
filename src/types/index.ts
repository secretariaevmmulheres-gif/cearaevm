import { TipoEquipamento, StatusSolicitacao, OrgaoResponsavel } from "@/data/municipios";

export type AppRole = 'admin' | 'editor' | 'viewer' | 'atividades_editor';

// ── Atividades ────────────────────────────────────────────────────────────────
export type TipoAtividade = 'Unidade Móvel' | 'Palestra' | 'Evento' | 'Tenda Lilás' | 'Visita a DDM' | 'Visita a Delegacia' | 'Qualificação' | 'Outro';
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
  municipios_participantes: string[];   // para qualificações — municípios que participaram
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
export type OrgaoPatrulha = 'PMCE' | 'Guarda Municipal' | 'Outro';

export interface Patrulha {
  id: string;
  equipamento_id: string | null;   // CMM inaugurada
  solicitacao_id: string | null;   // CMM em processo
  municipio: string;
  orgao: OrgaoPatrulha;
  efetivo: number | null;
  viaturas: number | null;
  responsavel: string | null;
  contato: string | null;
  data_implantacao: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}


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
  data_inauguracao: string | null;
  observacoes: string;
  anexos: string[];
  created_at: string;
  updated_at: string;
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

// ── Material Gráfico ──────────────────────────────────────────────────────────
export type MgTipoItem     = 'Folder' | 'Panfleto' | 'Ventarola' | 'Bottom' | 'Cartaz' | 'Outro';
export type MgSituacao     = 'Aguardando' | 'Em separação' | 'Atendido' | 'Cancelado';
export type MgFormaEntrega = 'Entregue' | 'Retirada';
export type MgUnidade      = 'caixas' | 'unidades';

export interface MgItem {
  id: string;
  tipo: MgTipoItem;
  campanha: string;
  descricao: string | null;
  peso_cx_g: number | null;        // peso por caixa em gramas
  unidades_por_cx: number | null;  // aprox. — pode ser null quando desconhecida
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MgEstoque {
  id: string;
  item_id: string;
  local: string;
  caixas: number;
  unidades_avulsas: number;
  updated_at: string;
}

export interface MgItemPedido {
  id: string;
  pedido_id: string;
  item_id: string;
  unidade_medida: MgUnidade;
  qtd_solicitada: number;
  qtd_autorizada: number | null;
  created_at: string;
  // join
  item?: MgItem;
}

export interface MgPedido {
  id: string;
  municipio: string | null;
  destino_avulso: string | null;
  nup: string | null;
  oficio: string | null;
  data_pedido: string | null;
  data_entrega: string | null;
  situacao: MgSituacao;
  forma_entrega: MgFormaEntrega | null;
  tipo_pedido: string | null;
  observacoes: string | null;
  estoque_abatido: boolean;
  created_at: string;
  updated_at: string;
  // join
  itens?: MgItemPedido[];
}