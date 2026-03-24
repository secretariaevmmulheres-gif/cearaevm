import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ── Constantes ────────────────────────────────────────────────────────────────

const BUCKET = 'solicitacoes-anexos';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx', '.xls', '.xlsx'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface Anexo {
  path: string;         // caminho no storage: "{solicitacao_id}/{filename}"
  nome: string;         // nome do arquivo para exibição
  tamanho?: number;     // bytes
  tipo?: string;        // mime type
  url?: string;         // URL assinada temporária (gerada sob demanda)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extrai o nome de exibição de um path do storage.
 * Path: "abc-123/2025-01-01_relatorio.pdf" → "relatorio.pdf"
 * (Remove prefixo de timestamp adicionado pelo upload)
 */
export function nomeDoPath(path: string): string {
  const filename = path.split('/').pop() ?? path;
  // Remove o prefixo de timestamp "YYYYMMDD_HHmmss_" se houver
  return filename.replace(/^\d{8}_\d{6}_/, '');
}

/** Ícone por tipo de arquivo */
export function iconeAnexo(path: string): 'pdf' | 'image' | 'doc' | 'xls' | 'file' {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['xls', 'xlsx'].includes(ext)) return 'xls';
  return 'file';
}

/** Formata tamanho de arquivo em string legível */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Valida um arquivo antes do upload */
function validarArquivo(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" excede o tamanho máximo de ${MAX_FILE_SIZE_MB} MB`;
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `"${file.name}" — tipo não permitido. Aceitos: PDF, imagens, Word, Excel`;
  }
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseAnexosReturn {
  uploading: boolean;
  uploadAnexos: (solicitacaoId: string, files: File[]) => Promise<string[]>;
  deleteAnexo: (path: string) => Promise<void>;
  getUrlAnexo: (path: string) => Promise<string | null>;
  baixarAnexo: (path: string) => Promise<void>;
  allowedExtensions: string[];
  maxSizeMb: number;
}

export function useAnexos(): UseAnexosReturn {
  const [uploading, setUploading] = useState(false);

  /**
   * Faz upload de múltiplos arquivos para o bucket.
   * Retorna array com os paths dos arquivos salvos.
   * O path tem o formato: "{solicitacaoId}/{timestamp}_{filename}"
   */
  const uploadAnexos = useCallback(async (
    solicitacaoId: string,
    files: File[]
  ): Promise<string[]> => {
    if (files.length === 0) return [];

    // Valida todos os arquivos antes de iniciar
    for (const file of files) {
      const erro = validarArquivo(file);
      if (erro) {
        toast.error(erro);
        return [];
      }
    }

    setUploading(true);
    const uploadedPaths: string[] = [];

    try {
      for (const file of files) {
        // Prefixo de timestamp para evitar colisões de nome
        const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 15);
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${solicitacaoId}/${ts}_${safeName}`;

        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw new Error(`Erro ao enviar "${file.name}": ${error.message}`);
        uploadedPaths.push(path);
      }

      toast.success(
        uploadedPaths.length === 1
          ? 'Anexo enviado com sucesso!'
          : `${uploadedPaths.length} anexos enviados com sucesso!`
      );
      return uploadedPaths;

    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar anexo');
      // Tenta remover os que já foram enviados em caso de erro parcial
      for (const path of uploadedPaths) {
        await supabase.storage.from(BUCKET).remove([path]);
      }
      return [];
    } finally {
      setUploading(false);
    }
  }, []);

  /**
   * Remove um arquivo do bucket.
   */
  const deleteAnexo = useCallback(async (path: string): Promise<void> => {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) {
      toast.error(`Erro ao remover anexo: ${error.message}`);
      throw error;
    }
  }, []);

  /**
   * Gera uma URL assinada com validade de 1 hora para download/preview.
   */
  const getUrlAnexo = useCallback(async (path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600); // 1 hora

    if (error) {
      console.error('Erro ao gerar URL do anexo:', error);
      return null;
    }
    return data.signedUrl;
  }, []);

  /**
   * Faz download de um arquivo abrindo em nova aba.
   */
  const baixarAnexo = useCallback(async (path: string): Promise<void> => {
    const url = await getUrlAnexo(path);
    if (!url) {
      toast.error('Não foi possível gerar o link de download');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [getUrlAnexo]);

  return {
    uploading,
    uploadAnexos,
    deleteAnexo,
    getUrlAnexo,
    baixarAnexo,
    allowedExtensions: ALLOWED_EXTENSIONS,
    maxSizeMb: MAX_FILE_SIZE_MB,
  };
}