import { useCallback, useEffect, useState } from 'react';

export function useApiResource(loader, dependencies = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const data = await loader();
      setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error }));
      return null;
    }
  // La lista explícita permite recargar el recurso sin repetir peticiones en cada render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  useEffect(() => { reload().catch(() => {}); }, [reload]);
  return { ...state, reload };
}
