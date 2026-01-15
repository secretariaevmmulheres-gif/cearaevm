import { TipoEquipamento, StatusSolicitacao, OrgaoResponsavel } from "@/data/municipios";

export type AppRole = 'admin' | 'editor' | 'viewer';

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

export interface Equipamento {
  id: string;
  municipio: string;
  tipo: TipoEquipamento;
  possui_patrulha: boolean;
  endereco: string;
  telefone: string;
  responsavel: string;
  observacoes: string;
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

export interface Solicitacao {
  id: string;
  municipio: string;
  data_solicitacao: string;
  tipo_equipamento: TipoEquipamento;
  status: StatusSolicitacao;
  recebeu_patrulha: boolean;
  guarda_municipal_estruturada: boolean;
  kit_athena_entregue: boolean;
  capacitacao_realizada: boolean;
  suite_implantada: string;
  observacoes: string;
  anexos: string[];
  created_at: string;
  updated_at: string;
}

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
