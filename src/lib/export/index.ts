/**
 * src/lib/export/index.ts
 *
 * Ponto de entrada único — re-exporta todos os módulos de export.
 *
 * Os arquivos do projeto continuam importando de '@/lib/exportUtils'
 * (que agora aponta para este index via alias ou barrel), sem precisar
 * mudar nenhum import existente.
 *
 * Estrutura:
 *   shared.ts            — helpers internos (fmtDate, addPdfHeader, etc.)
 *   exportEquipamentos.ts
 *   exportSolicitacoes.ts
 *   exportViaturas.ts
 *   exportAtividades.ts
 *   exportQualificacoes.ts
 *   exportDiagnostico.ts
 *   exportMapa.ts
 *   exportRegional.ts
 *   exportDashboard.ts
 *   exportCpdi.ts
 */

export * from './exportEquipamentos';
export * from './exportSolicitacoes';
export * from './exportViaturas';
export * from './exportAtividades';
export * from './exportQualificacoes';
export * from './exportDiagnostico';
export * from './exportMapa';
export * from './exportRegional';
export * from './exportDashboard';
export * from './exportCpdi';
export * from './exportMaterialGrafico';