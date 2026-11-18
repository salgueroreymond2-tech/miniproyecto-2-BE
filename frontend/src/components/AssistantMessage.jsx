import { useState } from 'react';
import { CitationCards } from './CitationCards';
import { MarkdownContent } from './MarkdownContent';
import { Button } from './ui/Button';
import { MaterialIcon } from './ui/MaterialIcon';
import { Tooltip } from './ui/Tooltip';
import { useToast } from './ui/ToastProvider';

function sourceLabel(message) {
  if (message.agentsUsed?.includes('DATOS_COLABORADOR')) return 'Tus datos · MySQL';
  if (message.citations?.length) return 'Documentación de RRHH';
  return 'Asistente de RRHH';
}

export function AssistantMessage({ message, onRetry }) {
  const [copied, setCopied] = useState(false);
  const notify = useToast();
  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.answer || '');
      setCopied(true);
      notify('Respuesta copiada al portapapeles.');
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); notify('No fue posible copiar la respuesta.', 'error'); }
  }

  return <article className="chat-turn" aria-label="Respuesta del asistente">
    <div className="assistant-avatar"><MaterialIcon name="auto_awesome" /></div>
    <div className="assistant-turn-body">
      <div className="assistant-turn-heading"><div><strong>NexoTico IA</strong><span className="source-label"><MaterialIcon name={message.agentsUsed?.includes('DATOS_COLABORADOR') ? 'database' : 'menu_book'} />{sourceLabel(message)}</span></div>
        {message.answer && <Tooltip label={copied ? 'Copiado' : 'Copiar respuesta'}><Button variant="quiet" size="icon" icon={copied ? 'check' : 'content_copy'} aria-label="Copiar respuesta" onClick={copyAnswer} /></Tooltip>}
      </div>
      <div className="assistant-answer">{message.loading ? <span className="processing-state"><span className="processing-dots" aria-hidden="true"><i /><i /><i /></span>Consultando la información…</span> : <MarkdownContent content={message.answer} />}</div>
      {!message.loading && <CitationCards citations={message.citations || []} />}
      {!message.loading && (message.escalationSuggested || message.resolved === false) && <p className="contact-guidance"><MaterialIcon name="support_agent" />Si necesitas confirmar esta respuesta, contacta a RRHH por el canal interno de la empresa.</p>}
      {message.failed && <div className="chat-retry" role="alert"><span>No pudimos completar esta consulta.</span><Button size="sm" variant="secondary" icon="refresh" onClick={onRetry}>Reintentar</Button></div>}
      {message.answer && <div className="assistant-footnote"><MaterialIcon name="verified_user" />No se muestran razonamientos internos del modelo.</div>}
    </div>
  </article>;
}
