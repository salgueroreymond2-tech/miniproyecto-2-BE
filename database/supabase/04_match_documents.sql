CREATE FUNCTION public.match_documents(query_embedding extensions.vector(768), match_threshold double precision DEFAULT 0.75, match_count integer DEFAULT 5)
RETURNS TABLE (id uuid, content text, title text, section text, version text, source_url text, similarity double precision)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, extensions AS $$
  SELECT d.id, d.content, d.title, d.section, d.version, d.source_url,
         1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) AS similarity
  FROM public.document_chunks AS d
  WHERE d.is_active AND d.validation_status = 'VALIDADO'
    AND match_threshold BETWEEN 0 AND 1 AND match_count BETWEEN 1 AND 20
    AND 1 - (d.embedding OPERATOR(extensions.<=>) query_embedding) >= match_threshold
  ORDER BY d.embedding OPERATOR(extensions.<=>) query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 20);
$$;

-- La publicación de una versión completa y el retiro de la anterior son atómicos dentro de Supabase.
CREATE FUNCTION public.publish_document_version(p_document_id uuid, p_version text, p_expected_count integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  IF p_document_id IS NULL OR p_version IS NULL OR length(trim(p_version)) = 0 OR p_expected_count IS NULL OR p_expected_count < 1 OR p_expected_count > 10000 THEN RAISE EXCEPTION 'Parámetros de publicación inválidos'; END IF;
  -- Evita que una inserción concurrente altere una versión mientras se valida y publica.
  LOCK TABLE public.document_chunks IN SHARE ROW EXCLUSIVE MODE;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_document_id::text, 0));
  SELECT count(*) INTO v_count FROM public.document_chunks
  WHERE document_id = p_document_id AND version = p_version AND validation_status <> 'ELIMINADO';
  IF v_count <> p_expected_count OR EXISTS (
    SELECT 1 FROM generate_series(0, p_expected_count - 1) AS n
    WHERE NOT EXISTS (SELECT 1 FROM public.document_chunks d WHERE d.document_id = p_document_id AND d.version = p_version AND d.chunk_index = n AND d.validation_status <> 'ELIMINADO')
  ) THEN RAISE EXCEPTION 'La versión está incompleta'; END IF;
  UPDATE public.document_chunks SET is_active = false WHERE document_id = p_document_id AND is_active AND version <> p_version;
  UPDATE public.document_chunks SET is_active = true, validation_status = 'VALIDADO' WHERE document_id = p_document_id AND version = p_version AND validation_status <> 'ELIMINADO';
  RETURN v_count;
END;
$$;
