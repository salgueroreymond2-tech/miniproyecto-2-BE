CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='vector' AND n.nspname='extensions') THEN
    RAISE EXCEPTION 'La extensión vector existe fuera del esquema extensions; adapte las referencias antes de continuar.';
  END IF;
END $$;
