import { useRef, useState, useCallback, useEffect } from 'react';
import { useAnexos, nomeDoPath, iconeAnexo, formatarTamanho } from '@/hooks/useAnexos';
import { useAuthContext } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Upload, X, Download, FileText, Image, File,
  FileSpreadsheet, Loader2, Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Ícone por tipo ────────────────────────────────────────────────────────────

function AnexoIcon({ path, className }: { path: string; className?: string }) {
  const tipo = iconeAnexo(path);
  const base = cn('shrink-0', className);
  if (tipo === 'pdf')   return <FileText className={cn(base, 'text-red-500')} />;
  if (tipo === 'image') return <Image    className={cn(base, 'text-blue-500')} />;
  if (tipo === 'doc')   return <FileText className={cn(base, 'text-blue-700')} />;
  if (tipo === 'xls')   return <FileSpreadsheet className={cn(base, 'text-emerald-600')} />;
  return <File className={cn(base, 'text-muted-foreground')} />;
}

// ── Preview de imagem ─────────────────────────────────────────────────────────

function ImagePreview({ path, getUrl }: { path: string; getUrl: (p: string) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUrl(path).then(url => { if (!cancelled && url) setSrc(url); });
    return () => { cancelled = true; };
  }, [path, getUrl]);

  if (!src) return <div className="w-8 h-8 rounded bg-muted animate-pulse" />;
  return (
    <img
      src={src}
      alt={nomeDoPath(path)}
      className="w-8 h-8 rounded object-cover border border-border"
    />
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface AnexosUploadProps {
  /** ID da solicitação — usado como prefixo do path no storage */
  solicitacaoId: string | null;
  /** Paths atuais salvos no banco (array de strings) */
  paths: string[];
  /** Callback quando os paths mudam (adicionar/remover) */
  onChange: (paths: string[]) => void;
  /** Se false, apenas exibe sem permitir alterações */
  readOnly?: boolean;
  /** Mostra label e área de upload mesmo sem arquivos */
  showEmpty?: boolean;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function AnexosUpload({
  solicitacaoId,
  paths,
  onChange,
  readOnly = false,
  showEmpty = true,
}: AnexosUploadProps) {
  const { role } = useAuthContext();
  const canEdit = !readOnly && role !== 'viewer' && role !== 'atividades_editor';

  const { uploading, uploadAnexos, deleteAnexo, getUrlAnexo, baixarAnexo, allowedExtensions, maxSizeMb } = useAnexos();

  const inputRef       = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);

  // ── Handlers de drag-and-drop ───────────────────────────────────────────
  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true);  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(false); }, []);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!canEdit) return;

    // Se a solicitação ainda não foi salva, não há ID para prefixar o path
    if (!solicitacaoId) {
      toast.error('Salve a solicitação antes de adicionar anexos');
      return;
    }

    const novos = await uploadAnexos(solicitacaoId, files);
    if (novos.length > 0) {
      onChange([...paths, ...novos]);
    }
  }, [canEdit, solicitacaoId, uploadAnexos, paths, onChange]);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  }, [handleFiles]);

  const onInputChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    await handleFiles(files);
    // Limpa o input para permitir re-upload do mesmo arquivo
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFiles]);

  // ── Remover anexo ────────────────────────────────────────────────────────
  const handleRemove = useCallback(async (path: string) => {
    setRemovingPath(path);
    try {
      await deleteAnexo(path);
      onChange(paths.filter(p => p !== path));
      toast.success('Anexo removido');
    } catch {
      // erro já exibido pelo hook
    } finally {
      setRemovingPath(null);
    }
  }, [deleteAnexo, paths, onChange]);

  // ── Render ───────────────────────────────────────────────────────────────

  if (!showEmpty && paths.length === 0 && !canEdit) return null;

  return (
    <div className="space-y-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">
          Anexos
          {paths.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              ({paths.length} arquivo{paths.length !== 1 ? 's' : ''})
            </span>
          )}
        </span>
      </div>

      {/* Área de upload (só para quem pode editar) */}
      {canEdit && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed transition-colors cursor-pointer',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30',
            uploading && 'pointer-events-none opacity-60'
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={allowedExtensions.join(',')}
            className="hidden"
            onChange={onInputChange}
          />
          {uploading ? (
            <>
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
              <p className="text-xs text-muted-foreground">Enviando...</p>
            </>
          ) : (
            <>
              <Upload className="w-5 h-5 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-medium">
                  {dragging ? 'Solte os arquivos aqui' : 'Clique ou arraste arquivos'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  PDF, imagens, Word, Excel · máx. {maxSizeMb} MB por arquivo
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Lista de anexos */}
      {paths.length > 0 && (
        <div className="space-y-1.5">
          {paths.map(path => {
            const nome  = nomeDoPath(path);
            const tipo  = iconeAnexo(path);
            const isImg = tipo === 'image';
            const isRemoving = removingPath === path;

            return (
              <div
                key={path}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/60 bg-card group"
              >
                {/* Ícone ou thumbnail */}
                {isImg ? (
                  <ImagePreview path={path} getUrl={getUrlAnexo} />
                ) : (
                  <AnexoIcon path={path} className="w-4 h-4" />
                )}

                {/* Nome */}
                <span className="flex-1 min-w-0 text-xs truncate" title={nome}>
                  {nome}
                </span>

                {/* Ações */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Download / Abrir */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); baixarAnexo(path); }}
                    title="Abrir / baixar"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>

                  {/* Remover (só para quem pode editar) */}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleRemove(path); }}
                      disabled={isRemoving}
                      title="Remover anexo"
                    >
                      {isRemoving
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <X className="w-3.5 h-3.5" />
                      }
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Estado vazio para read-only */}
      {!canEdit && paths.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic">Nenhum anexo.</p>
      )}
    </div>
  );
}

export default AnexosUpload;