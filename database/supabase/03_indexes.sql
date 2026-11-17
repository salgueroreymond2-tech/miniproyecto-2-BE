CREATE INDEX document_chunks_embedding_hnsw ON public.document_chunks
USING hnsw (embedding extensions.vector_cosine_ops) WHERE is_active AND validation_status = 'VALIDADO';
CREATE INDEX document_chunks_filter_idx ON public.document_chunks (category, effective_date) WHERE is_active AND validation_status = 'VALIDADO';
CREATE INDEX document_chunks_drive_idx ON public.document_chunks (drive_file_id);
