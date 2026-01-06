-- Change suite_implantada from integer to text to store NUP process numbers
ALTER TABLE public.solicitacoes 
ALTER COLUMN suite_implantada TYPE text USING COALESCE(suite_implantada::text, '');

-- Set default value
ALTER TABLE public.solicitacoes 
ALTER COLUMN suite_implantada SET DEFAULT '';