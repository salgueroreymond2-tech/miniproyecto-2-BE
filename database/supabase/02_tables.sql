CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL,
  drive_file_id text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  section text,
  page_number integer CHECK (page_number IS NULL OR page_number > 0),
  chunk_index integer NOT NULL CHECK (chunk_index >= 0),
  version text NOT NULL,
  source_url text,
  category text NOT NULL CHECK (category IN ('POLITICA', 'PROCEDIMIENTO', 'DOCUMENTO_PUBLICO')),
  effective_date date,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  embedding_model text NOT NULL DEFAULT 'gemini-embedding-001' CHECK (embedding_model = 'gemini-embedding-001'),
  embedding extensions.vector(768) NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_status text NOT NULL DEFAULT 'PENDIENTE' CHECK (validation_status IN ('PENDIENTE', 'VALIDADO', 'ELIMINADO')),
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_active OR validation_status = 'VALIDADO'),
  UNIQUE (document_id, version, chunk_index)
);

CREATE FUNCTION public.document_chunks_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER document_chunks_updated_at BEFORE UPDATE ON public.document_chunks
FOR EACH ROW EXECUTE FUNCTION public.document_chunks_touch_updated_at();
