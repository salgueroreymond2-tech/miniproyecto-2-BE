import { MaterialIcon } from './ui/MaterialIcon';

function driveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}

export function CitationCards({ citations = [] }) {
  if (!citations.length) return null;
  return <section className="citations" aria-label="Fuentes documentales">
    <p className="citation-heading"><MaterialIcon name="source" /> Fuentes documentales</p>
    <div className="citation-list">{citations.map((citation, index) => {
      const href = driveUrl(citation.link || citation.url);
      return <article className="citation-card" key={`${citation.title || 'fuente'}-${citation.section || index}-${index}`}>
        <span className="citation-index">{citation.reference || index + 1}</span>
        <div className="citation-copy"><strong>{citation.title || 'Documento de Recursos Humanos'}</strong>
          <span>{citation.section || 'Sección documental'}{citation.version ? ` · v${citation.version}` : ''}{citation.page ? ` · pág. ${citation.page}` : citation.pageNumber ? ` · pág. ${citation.pageNumber}` : ''}</span>
        </div>
        {href ? <a className="citation-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${citation.title || 'documento'} en Google Drive`}><MaterialIcon name="open_in_new" /></a> : <span className="citation-no-link" aria-label="No hay enlace de Google Drive disponible"><MaterialIcon name="description" /></span>}
      </article>;
    })}</div>
  </section>;
}
