
# Ajuste Completo das Exportações

## Resumo

Todas as funcionalidades de exportação serão atualizadas para incluir informações completas e consistentes em todos os módulos (Equipamentos, Viaturas, Solicitações, Patrulhas das Casas, Dashboard e Relatórios Regionais).

## Problemas Identificados

### 1. Patrulhas das Casas (Prioridade Alta)
- Atualmente exporta APENAS equipamentos com patrulha
- Faltam as patrulhas vindas de solicitacoes (recebeu_patrulha = true)
- Total esperado: 52 registros | Atual: apenas 31

### 2. Equipamentos
- PDF faltando: Endereco, Observacoes, Regiao
- Excel esta mais completo, mas falta Regiao

### 3. Viaturas PMCE
- PDF faltando: Observacoes
- Falta Regiao em ambos (PDF e Excel)

### 4. Solicitacoes
- PDF e Excel ja estao razoavelmente completos
- Falta Regiao do municipio

### 5. Exportacao Geral (Dashboard)
- Falta Regiao em todas as tabelas
- PDF de Solicitacoes faltando alguns campos de acompanhamento

---

## Mudancas Detalhadas

### Arquivo: `src/lib/exportUtils.ts`

#### 1. Nova funcao para Patrulhas das Casas (Completa)

```typescript
// Novo tipo para patrulhas unificadas
interface PatrulhaCasaExport {
  municipio: string;
  regiao: string;
  tipo: string;
  origem: 'Equipamento' | 'Solicitacao';
  status?: string;
  endereco?: string;
  responsavel?: string;
  telefone?: string;
}

// Atualizar exportPatrulhasCasasToPDF
// - Receber equipamentos E solicitacoes
// - Combinar patrulhas de ambas fontes
// - Adicionar coluna Regiao e Origem
// - Evitar duplicidade por municipio
```

**Colunas do PDF/Excel:**
| Municipio | Regiao | Tipo Equipamento | Origem | Status | Endereco | Responsavel | Telefone |

#### 2. Equipamentos - Adicionar Regiao e mais campos

**PDF - Colunas atualizadas:**
| Municipio | Regiao | Tipo | Patrulha M.P. | Endereco | Responsavel | Telefone |

**Excel - Colunas atualizadas:**
| Municipio | Regiao | Tipo | Patrulha M.P. | Endereco | Responsavel | Telefone | Observacoes | Data Criacao |

#### 3. Viaturas PMCE - Adicionar Regiao

**PDF - Colunas atualizadas:**
| Municipio | Regiao | Orgao | Qtd | Implantacao | Vinculada | Responsavel |

**Excel - Colunas atualizadas:**
| Municipio | Regiao | Tipo | Orgao | Qtd | Vinculada | Data Implantacao | Responsavel | Observacoes |

#### 4. Solicitacoes - Adicionar Regiao

**PDF - Colunas atualizadas:**
| Municipio | Regiao | Tipo | Status | Data | NUP | Guarda | Patrulha | Kit Athena | Capacitacao |

**Excel - Colunas atualizadas:**
| Municipio | Regiao | Tipo | Status | Data | NUP | Guarda | Patrulha | Kit Athena | Capacitacao | Observacoes |

#### 5. Exportacao Geral (exportAllToPDF e exportAllToExcel)

- Adicionar coluna Regiao em todas as tabelas
- Completar campos faltantes nas Solicitacoes

---

### Arquivo: `src/pages/Viaturas.tsx`

Atualizar chamadas de exportacao para passar tanto `equipamentos` quanto `solicitacoes` para as funcoes de exportacao de Patrulhas das Casas:

```typescript
// Antes
onClick={() => exportPatrulhasCasasToPDF(patrulhasDeEquipamentos)}

// Depois  
onClick={() => exportPatrulhasCasasToPDF(equipamentos, solicitacoes)}
```

---

## Resumo das Colunas por Exportacao

### Equipamentos
| Campo | PDF | Excel |
|-------|-----|-------|
| Municipio | Sim | Sim |
| Regiao | NOVO | NOVO |
| Tipo | Sim | Sim |
| Patrulha M.P. | Sim | Sim |
| Endereco | NOVO | Sim |
| Responsavel | Sim | Sim |
| Telefone | Sim | Sim |
| Observacoes | - | Sim |
| Data Criacao | - | Sim |

### Viaturas PMCE
| Campo | PDF | Excel |
|-------|-----|-------|
| Municipio | Sim | Sim |
| Regiao | NOVO | NOVO |
| Tipo Patrulha | Sim | Sim |
| Orgao | Sim | Sim |
| Quantidade | Sim | Sim |
| Vinculada | Sim | Sim |
| Data Implantacao | Sim | Sim |
| Responsavel | Sim | Sim |
| Observacoes | - | Sim |

### Patrulhas das Casas
| Campo | PDF | Excel |
|-------|-----|-------|
| Municipio | Sim | Sim |
| Regiao | NOVO | NOVO |
| Tipo Equipamento | Sim | Sim |
| Origem | NOVO | NOVO |
| Status | NOVO | NOVO |
| Endereco | Sim | Sim |
| Responsavel | Sim | Sim |
| Telefone | Sim | Sim |
| Observacoes | - | Sim |

### Solicitacoes
| Campo | PDF | Excel |
|-------|-----|-------|
| Municipio | Sim | Sim |
| Regiao | NOVO | NOVO |
| Tipo | Sim | Sim |
| Status | Sim | Sim |
| Data | Sim | Sim |
| NUP | Sim | Sim |
| Guarda | Sim | Sim |
| Patrulha | Sim | Sim |
| Kit Athena | Sim | Sim |
| Capacitacao | Sim | Sim |
| Observacoes | - | Sim |

---

## Arquivos a Modificar

1. **`src/lib/exportUtils.ts`**
   - Atualizar `exportEquipamentosToPDF` - adicionar Regiao e Endereco
   - Atualizar `exportEquipamentosToExcel` - adicionar Regiao
   - Atualizar `exportViaturasToPDF` - adicionar Regiao
   - Atualizar `exportViaturasToExcel` - adicionar Regiao
   - Atualizar `exportSolicitacoesToPDF` - adicionar Regiao
   - Atualizar `exportSolicitacoesToExcel` - adicionar Regiao
   - Reescrever `exportPatrulhasCasasToPDF` - aceitar equipamentos E solicitacoes
   - Reescrever `exportPatrulhasCasasToExcel` - aceitar equipamentos E solicitacoes
   - Atualizar `exportAllToPDF` - adicionar Regiao e campos completos
   - Atualizar `exportAllToExcel` - adicionar Regiao

2. **`src/pages/Viaturas.tsx`**
   - Atualizar chamadas de `exportPatrulhasCasasToPDF` e `exportPatrulhasCasasToExcel`
   - Passar `equipamentos` e `solicitacoes` como parametros

---

## Resultado Esperado

- Todas as exportacoes incluirao a Regiao do municipio
- Patrulhas das Casas exportara os 52 registros (equipamentos + solicitacoes)
- Informacoes consistentes entre tela e exportacao
- PDFs em formato paisagem quando necessario para acomodar mais colunas
