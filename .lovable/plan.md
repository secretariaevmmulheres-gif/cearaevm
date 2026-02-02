
# Preview de Captura do Mapa antes de Exportar PDF

## Resumo

Implementar um modal de pré-visualização que mostra uma miniatura da captura do mapa antes de gerar o PDF final. Isso permite ao usuário verificar se o alinhamento está correto e confirmar ou cancelar a exportação.

## Como vai funcionar

1. O usuário clica em "Exportar Mapa PDF"
2. O sistema captura uma imagem do mapa (usando html2canvas)
3. Um modal abre mostrando a miniatura da captura
4. O usuário pode:
   - **Confirmar**: Gera o PDF com a imagem capturada
   - **Cancelar**: Fecha o modal sem exportar
   - **Recapturar**: Tenta capturar novamente caso a imagem não esteja boa

## Fluxo Visual

```text
┌─────────────────────────────────────────────────┐
│           Preview da Exportação                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌─────────────────────────────────────────┐    │
│  │                                         │    │
│  │          [Miniatura do Mapa]            │    │
│  │           (imagem capturada)            │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  "Verifique se o mapa está alinhado            │
│   corretamente antes de exportar."             │
│                                                 │
├─────────────────────────────────────────────────┤
│  [Recapturar]     [Cancelar]    [Exportar PDF] │
└─────────────────────────────────────────────────┘
```

---

## Detalhes Técnicos

### Arquivos a serem modificados

**1. `src/pages/Mapa.tsx`**
- Adicionar estado para controlar o modal de preview (`showExportPreview`)
- Adicionar estado para armazenar a imagem capturada (`previewImageData`)
- Modificar `handleExportMap` para:
  - Capturar a imagem primeiro
  - Abrir o modal de preview em vez de exportar diretamente
- Criar nova função `handleConfirmExport` que:
  - Usa a imagem já capturada para gerar o PDF
- Criar nova função `handleRecapture` para recapturar a imagem
- Adicionar componente Dialog para o modal de preview

**2. `src/lib/exportUtils.ts`**
- Criar nova função auxiliar `captureMapImage` que:
  - Faz apenas a captura html2canvas
  - Retorna o dataURL da imagem e as dimensões do canvas
- Modificar `exportMapToPDF` para aceitar opcionalmente uma imagem pré-capturada:
  - Se receber imagem, usa ela diretamente
  - Se não receber, captura normalmente (compatibilidade)

### Novos estados no Mapa.tsx
```typescript
const [showExportPreview, setShowExportPreview] = useState(false);
const [previewImageData, setPreviewImageData] = useState<{
  dataUrl: string;
  width: number;
  height: number;
} | null>(null);
```

### Nova função captureMapImage
```typescript
export async function captureMapImage(
  mapElement: HTMLElement,
  highResolution: boolean = false
): Promise<{ dataUrl: string; width: number; height: number }>
```

### Fluxo de exportação atualizado
1. Usuário clica em "Exportar Mapa PDF"
2. `handleExportMap`:
   - Invalida o tamanho do mapa (leaflet)
   - Aguarda tiles renderizarem
   - Chama `captureMapImage` 
   - Armazena resultado em `previewImageData`
   - Abre modal (`setShowExportPreview(true)`)
3. Usuário confirma no modal
4. `handleConfirmExport`:
   - Chama `exportMapToPDF` passando `previewImageData`
   - Fecha modal
   - Mostra toast de sucesso

### Interface do Modal
- Imagem com borda arredondada e sombra
- Máximo 80% da largura/altura da viewport
- Texto explicativo: "Verifique se o mapa está alinhado corretamente"
- 3 botões: Recapturar (outline), Cancelar (ghost), Exportar PDF (primary)
