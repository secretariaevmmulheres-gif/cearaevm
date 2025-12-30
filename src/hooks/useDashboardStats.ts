import { useDataStore } from '@/store/dataStore';
import { municipiosCeara, tiposEquipamento, statusSolicitacao, orgaosResponsaveis } from '@/data/municipios';
import { DashboardStats } from '@/types';
import { useMemo } from 'react';

export function useDashboardStats(): DashboardStats {
  const { equipamentos, viaturas, solicitacoes } = useDataStore();

  return useMemo(() => {
    const municipiosComEquipamento = new Set(equipamentos.map((e) => e.municipio));
    const municipiosComViatura = new Set(viaturas.map((v) => v.municipio));

    const equipamentosPorTipo = tiposEquipamento.reduce((acc, tipo) => {
      acc[tipo] = equipamentos.filter((e) => e.tipo === tipo).length;
      return acc;
    }, {} as Record<typeof tiposEquipamento[number], number>);

    const viaturasPorOrgao = orgaosResponsaveis.reduce((acc, orgao) => {
      acc[orgao] = viaturas.filter((v) => v.orgaoResponsavel === orgao).reduce((sum, v) => sum + v.quantidade, 0);
      return acc;
    }, {} as Record<typeof orgaosResponsaveis[number], number>);

    const solicitacoesPorStatus = statusSolicitacao.reduce((acc, status) => {
      acc[status] = solicitacoes.filter((s) => s.status === status).length;
      return acc;
    }, {} as Record<typeof statusSolicitacao[number], number>);

    const solicitacoesPorTipo = tiposEquipamento.reduce((acc, tipo) => {
      acc[tipo] = solicitacoes.filter((s) => s.tipoEquipamento === tipo).length;
      return acc;
    }, {} as Record<typeof tiposEquipamento[number], number>);

    let municipiosComViaturaSemEquipamento = 0;
    let municipiosComViaturaComEquipamento = 0;

    municipiosComViatura.forEach((m) => {
      if (municipiosComEquipamento.has(m)) {
        municipiosComViaturaComEquipamento++;
      } else {
        municipiosComViaturaSemEquipamento++;
      }
    });

    return {
      totalEquipamentos: equipamentos.length,
      equipamentosPorTipo,
      municipiosComEquipamento: municipiosComEquipamento.size,
      municipiosSemEquipamento: municipiosCeara.length - municipiosComEquipamento.size,
      equipamentosComPatrulha: equipamentos.filter((e) => e.possuiPatrulha).length,
      totalViaturas: viaturas.reduce((sum, v) => sum + v.quantidade, 0),
      municipiosComViaturaSemEquipamento,
      municipiosComViaturaComEquipamento,
      viaturasPorOrgao,
      totalSolicitacoes: solicitacoes.length,
      solicitacoesPorStatus,
      solicitacoesPorTipo,
    };
  }, [equipamentos, viaturas, solicitacoes]);
}
