

# Correção do Dashboard Regional e Exportação Geral

## Problemas Identificados

### 1. Dashboard Regional - Contagem de Viaturas Incompleta
A contagem atual de viaturas por região (linha 93 do DashboardRegional.tsx) soma apenas:
- Viaturas cadastradas na tabela `viaturas`
- Patrulhas de equipamentos com `possui_patrulha = true`

**Faltam:** As patrulhas vindas de **solicitações** onde `recebeu_patrulha = true`, que estão sendo contadas corretamente no Dashboard principal mas ignoradas no Regional.

### 2. Exportação Geral (Dashboard) - Resumo Confuso
O botão "Exportar Tudo" gera um PDF com resumo que mistura conceitos de viaturas, tornando difícil entender:
- Quantas são Viaturas PMCE (da tabela viaturas)
- Quantas são Patrulhas das Casas (equipamentos + solicitações)

### 3. Exportação Regional - Falta de Patrulhas de Solicitações
As exportações PDF e Excel do Dashboard Regional não incluem patrulhas de solicitações no cálculo por região.

---

## Solução Proposta

### Arquivo: `src/pages/DashboardRegional.tsx`

**Mudança 1: Atualizar cálculo de `regionStats`**

Adicionar contagem de patrulhas de solicitações por região:

```typescript
// Patrulhas de solicitações na região (exclui duplicidade com equipamentos)
const municipiosComPatrulhaEquip = new Set(
  equipamentosDaRegiao.filter(e => e.possui_patrulha).map(e => e.municipio)
);
const patrulhasDeSolicitacoes = solicitacoesDaRegiao.filter(
  s => s.recebeu_patrulha && !municipiosComPatrulhaEquip.has(s.municipio)
).length;

// Total correto de patrulhas das casas na região
const patrulhasCasasRegiao = patrulhasEmEquipamentos + patrulhasDeSolicitacoes;
```

**Mudança 2: Atualizar interface RegionStats**

Adicionar campo `patrulhasDeSolicitacoes` para rastreamento separado.

**Mudança 3: Atualizar cards de resumo**

Mostrar detalhamento de patrulhas de equipamentos vs solicitações.

---

### Arquivo: `src/lib/exportUtils.ts`

**Mudança 1: Atualizar `exportAllToPDF`**

Melhorar o resumo geral com seções claras:
- Equipamentos (total e com/sem patrulha)
- Viaturas PMCE (total da tabela viaturas)
- Patrulhas das Casas (equipamentos + solicitações)
- Solicitações

Adicionar aba separada para "Patrulhas das Casas" no PDF.

**Mudança 2: Atualizar `exportAllToExcel`**

Adicionar sheet separada para "Patrulhas das Casas" no Excel.

**Mudança 3: Atualizar `exportAllRegionsToPDF` e `exportAllRegionsToExcel`**

Incluir patrulhas de solicitações no cálculo por região.

---

## Estrutura do Novo Resumo (Exportar Tudo PDF)

```text
RESUMO GERAL - ESTADO DO CEARÁ
==============================

EQUIPAMENTOS
• Total de Equipamentos: XX
  - Com Patrulha M.P.: XX
  - Sem Patrulha M.P.: XX

VIATURAS PMCE
• Total de Viaturas PMCE: XX
  - Vinculadas a Equipamentos: XX
  - Não Vinculadas: XX

PATRULHAS DAS CASAS
• Total de Patrulhas das Casas: XX
  - De Equipamentos: XX
  - De Solicitações: XX

SOLICITAÇÕES
• Total de Solicitações: XX
  - Em Andamento: XX
  - Inauguradas: XX
  - Canceladas: XX
```

---

## Arquivos a Modificar

1. **`src/pages/DashboardRegional.tsx`**
   - Atualizar interface `RegionStats` com `patrulhasDeSolicitacoes`
   - Modificar useMemo que calcula `regionStats` para incluir patrulhas de solicitações
   - Atualizar cards de resumo para mostrar detalhamento

2. **`src/lib/exportUtils.ts`**
   - Atualizar `exportAllToPDF`:
     - Reorganizar resumo com seções claras
     - Adicionar tabela de Patrulhas das Casas
   - Atualizar `exportAllToExcel`:
     - Adicionar sheet "Patrulhas Casas"
   - Atualizar `exportAllRegionsToPDF` e `exportAllRegionsToExcel`:
     - Recalcular totais de viaturas incluindo patrulhas de solicitações
     - Separar claramente PMCE vs Patrulhas das Casas

---

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Viaturas por Região | Conta só equipamentos com patrulha | Conta equipamentos + solicitações |
| Exportar Tudo PDF | Resumo confuso, mistura categorias | Resumo claro com 4 seções |
| Exportar Tudo Excel | 3 abas | 4 abas (+ Patrulhas Casas) |
| Total Patrulhas Regional | ~31 (só equipamentos) | ~52 (equipamentos + solicitações) |

