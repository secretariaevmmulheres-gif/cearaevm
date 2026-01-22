import { useEquipamentos } from '@/hooks/useEquipamentos';
import { useViaturas } from '@/hooks/useViaturas';
import { useSolicitacoes } from '@/hooks/useSolicitacoes';
import { municipiosCeara, tiposEquipamento, statusSolicitacao, orgaosResponsaveis } from '@/data/municipios';
import { DashboardStats } from '@/types';
import { useMemo } from 'react';

export function useDashboardStats(): DashboardStats {
  const { equipamentos } = useEquipamentos();
  const { viaturas } = useViaturas();
  const { solicitacoes } = useSolicitacoes();

  return useMemo(() => {
    const municipiosComEquipamento = new Set(equipamentos.map((e) => e.municipio));
    const municipiosComViatura = new Set(viaturas.map((v) => v.municipio));

    const equipamentosPorTipo = tiposEquipamento.reduce((acc, tipo) => {
      acc[tipo] = equipamentos.filter((e) => e.tipo === tipo).length;
      return acc;
    }, {} as Record<typeof tiposEquipamento[number], number>);

    const viaturasPorOrgao = orgaosResponsaveis.reduce((acc, orgao) => {
      acc[orgao] = viaturas.filter((v) => v.orgao_responsavel === orgao).reduce((sum, v) => sum + v.quantidade, 0);
      return acc;
    }, {} as Record<typeof orgaosResponsaveis[number], number>);

    const solicitacoesPorStatus = statusSolicitacao.reduce((acc, status) => {
      acc[status] = solicitacoes.filter((s) => s.status === status).length;
      return acc;
    }, {} as Record<typeof statusSolicitacao[number], number>);

    const solicitacoesPorTipo = tiposEquipamento.reduce((acc, tipo) => {
      acc[tipo] = solicitacoes.filter((s) => s.tipo_equipamento === tipo).length;
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

    // Patrulhas das Casas = equipamentos com possui_patrulha OU solicitações com recebeu_patrulha
    // Conta equipamentos inaugurados com patrulha
    const patrulhasEquipamentos = equipamentos.filter((e) => e.possui_patrulha).length;
    // Conta solicitações que receberam patrulha mas ainda não viraram equipamento
    const municipiosComEquipamentoPatrulha = new Set(
      equipamentos.filter((e) => e.possui_patrulha).map((e) => e.municipio)
    );
    const patrulhasSolicitacoes = solicitacoes.filter(
      (s) => s.recebeu_patrulha && !municipiosComEquipamentoPatrulha.has(s.municipio)
    ).length;
    const viaturasPatrulhasCasas = patrulhasEquipamentos + patrulhasSolicitacoes;
    
    // Viaturas PMCE = soma das quantidades de todas as viaturas cadastradas
    const viaturasPMCE = viaturas.reduce((sum, v) => sum + v.quantidade, 0);

    return {
      totalEquipamentos: equipamentos.length,
      equipamentosPorTipo,
      municipiosComEquipamento: municipiosComEquipamento.size,
      municipiosSemEquipamento: municipiosCeara.length - municipiosComEquipamento.size,
      equipamentosComPatrulha: viaturasPatrulhasCasas,
      totalViaturas: viaturasPMCE + viaturasPatrulhasCasas,
      viaturasPatrulhasCasas,
      viaturasPMCE,
      municipiosComViaturaSemEquipamento,
      municipiosComViaturaComEquipamento,
      viaturasPorOrgao,
      totalSolicitacoes: solicitacoes.length,
      solicitacoesPorStatus,
      solicitacoesPorTipo,
    };
  }, [equipamentos, viaturas, solicitacoes]);
}
