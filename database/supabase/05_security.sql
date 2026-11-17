ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.document_chunks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_documents(extensions.vector, double precision, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_document_version(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_chunks TO service_role;
GRANT EXECUTE ON FUNCTION public.match_documents(extensions.vector, double precision, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.publish_document_version(uuid, text, integer) TO service_role;
