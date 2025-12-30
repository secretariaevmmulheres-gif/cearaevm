import { TipoEquipamento, StatusSolicitacao, OrgaoResponsavel } from "@/data/municipios";

export interface Equipamento {
  id: string;
  municipio: string;
  tipo: TipoEquipamento;
  possuiPatrulha: boolean;
  endereco: string;
  telefone: string;
  responsavel: string;
  observacoes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Viatura {
  id: string;
  municipio: string;
  tipoPatrulha: "Patrulha Maria da Penha";
  vinculadaEquipamento: boolean;
  equipamentoId?: string;
  orgaoResponsavel: OrgaoResponsavel;
  quantidade: number;
  dataImplantacao: Date;
  responsavel: string;
  observacoes: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Solicitacao {
  id: string;
  municipio: string;
  dataSolicitacao: Date;
  tipoEquipamento: TipoEquipamento;
  status: StatusSolicitacao;
  recebeuPatrulha: boolean;
  guardaMunicipalEstruturada: boolean;
  kitAthenaEntregue: boolean;
  capacitacaoRealizada: boolean;
  suiteImplantada: boolean;
  observacoes: string;
  anexos: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardStats {
  totalEquipamentos: number;
  equipamentosPorTipo: Record<TipoEquipamento, number>;
  municipiosComEquipamento: number;
  municipiosSemEquipamento: number;
  equipamentosComPatrulha: number;
  totalViaturas: number;
  municipiosComViaturaSemEquipamento: number;
  municipiosComViaturaComEquipamento: number;
  viaturasPorOrgao: Record<OrgaoResponsavel, number>;
  totalSolicitacoes: number;
  solicitacoesPorStatus: Record<StatusSolicitacao, number>;
  solicitacoesPorTipo: Record<TipoEquipamento, number>;
}
