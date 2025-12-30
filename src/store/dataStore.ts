import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Equipamento, Viatura, Solicitacao } from '@/types';
import { TipoEquipamento, StatusSolicitacao, OrgaoResponsavel } from '@/data/municipios';

interface DataState {
  equipamentos: Equipamento[];
  viaturas: Viatura[];
  solicitacoes: Solicitacao[];
  
  // Equipamento actions
  addEquipamento: (equipamento: Omit<Equipamento, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateEquipamento: (id: string, data: Partial<Equipamento>) => void;
  deleteEquipamento: (id: string) => void;
  
  // Viatura actions
  addViatura: (viatura: Omit<Viatura, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateViatura: (id: string, data: Partial<Viatura>) => void;
  deleteViatura: (id: string) => void;
  
  // Solicitacao actions
  addSolicitacao: (solicitacao: Omit<Solicitacao, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSolicitacao: (id: string, data: Partial<Solicitacao>) => void;
  deleteSolicitacao: (id: string) => void;
  transformarEmEquipamento: (solicitacaoId: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2, 11);

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      equipamentos: [],
      viaturas: [],
      solicitacoes: [],
      
      addEquipamento: (equipamento) => {
        const now = new Date();
        set((state) => ({
          equipamentos: [...state.equipamentos, {
            ...equipamento,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          }],
        }));
      },
      
      updateEquipamento: (id, data) => {
        set((state) => ({
          equipamentos: state.equipamentos.map((e) =>
            e.id === id ? { ...e, ...data, updatedAt: new Date() } : e
          ),
        }));
      },
      
      deleteEquipamento: (id) => {
        set((state) => ({
          equipamentos: state.equipamentos.filter((e) => e.id !== id),
          viaturas: state.viaturas.map((v) =>
            v.equipamentoId === id ? { ...v, vinculadaEquipamento: false, equipamentoId: undefined } : v
          ),
        }));
      },
      
      addViatura: (viatura) => {
        const now = new Date();
        set((state) => ({
          viaturas: [...state.viaturas, {
            ...viatura,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          }],
        }));
      },
      
      updateViatura: (id, data) => {
        set((state) => ({
          viaturas: state.viaturas.map((v) =>
            v.id === id ? { ...v, ...data, updatedAt: new Date() } : v
          ),
        }));
      },
      
      deleteViatura: (id) => {
        set((state) => ({
          viaturas: state.viaturas.filter((v) => v.id !== id),
        }));
      },
      
      addSolicitacao: (solicitacao) => {
        const now = new Date();
        set((state) => ({
          solicitacoes: [...state.solicitacoes, {
            ...solicitacao,
            id: generateId(),
            createdAt: now,
            updatedAt: now,
          }],
        }));
      },
      
      updateSolicitacao: (id, data) => {
        set((state) => ({
          solicitacoes: state.solicitacoes.map((s) =>
            s.id === id ? { ...s, ...data, updatedAt: new Date() } : s
          ),
        }));
      },
      
      deleteSolicitacao: (id) => {
        set((state) => ({
          solicitacoes: state.solicitacoes.filter((s) => s.id !== id),
        }));
      },
      
      transformarEmEquipamento: (solicitacaoId) => {
        const solicitacao = get().solicitacoes.find((s) => s.id === solicitacaoId);
        if (!solicitacao || solicitacao.status !== 'Inaugurada') return;
        
        const now = new Date();
        set((state) => ({
          equipamentos: [...state.equipamentos, {
            id: generateId(),
            municipio: solicitacao.municipio,
            tipo: solicitacao.tipoEquipamento,
            possuiPatrulha: solicitacao.recebeuPatrulha,
            endereco: '',
            telefone: '',
            responsavel: '',
            observacoes: `Criado a partir da solicitação ${solicitacaoId}. ${solicitacao.observacoes}`,
            createdAt: now,
            updatedAt: now,
          }],
        }));
      },
    }),
    {
      name: 'spm-data-store',
    }
  )
);
