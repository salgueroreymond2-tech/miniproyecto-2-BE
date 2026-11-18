import { useCallback, useEffect, useRef, useState } from 'react';
import { hrService } from '../services/hrService';
import { displayLabel, formatDate } from '../utils/format';
import { AssistantMessage } from '../components/AssistantMessage';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { MaterialIcon } from '../components/ui/MaterialIcon';
import { EmptyState } from '../components/ui/Feedback';
import { ResourceError } from '../components/ResourceState';

const suggestions = [
  { icon: 'beach_access', text: '¿Cuántos días de vacaciones me quedan?' },
  { icon: 'event', text: '¿Cuál es mi próximo día de pago?' },
  { icon: 'menu_book', text: '¿Cómo puedo solicitar un permiso?' },
  { icon: 'home_work', text: '¿Qué dice la política de teletrabajo?' }
];

function requestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function messageFromRecord(record) {
  return {
    id: record.id,
    question: record.question,
    answer: record.answer || 'No hay una respuesta guardada para esta consulta.',
    citations: record.citations || [],
    agentsUsed: record.agentsUsed || [],
    resolved: record.resolved,
    escalationSuggested: record.escalationSuggested,
    createdAt: record.createdAt
  };
}

export function AssistantPage() {
  const [conversations, setConversations] = useState([]);
  const [legacyHistory, setLegacyHistory] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showLegacyHistory, setShowLegacyHistory] = useState(false);
  const [draft, setDraft] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  const [sending, setSending] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const textareaRef = useRef(null);
  const bottomRef = useRef(null);
  const requestSequence = useRef(0);

  const refreshConversations = useCallback(async () => {
    const items = await hrService.chat.conversations();
    setConversations(items);
    return items;
  }, []);

  const openConversation = useCallback(async (id) => {
    setActiveId(id);
    setShowLegacyHistory(false);
    setMobileHistoryOpen(false);
    setLoadingConversation(true);
    setHistoryError(null);
    const sequence = ++requestSequence.current;
    try {
      const detail = await hrService.chat.conversation(id);
      if (requestSequence.current !== sequence) return;
      setMessages((detail.messages || []).map(messageFromRecord));
    } catch (error) {
      if (requestSequence.current === sequence) setHistoryError(error);
    } finally {
      if (requestSequence.current === sequence) setLoadingConversation(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoadingHistory(true);
    setHistoryError(null);
    const [conversationResult, historyResult] = await Promise.allSettled([
      refreshConversations(), hrService.chat.history()
    ]);
    if (requestSequence.current !== sequence) return;
    const allHistory = historyResult.status === 'fulfilled' ? historyResult.value : [];
    const legacyMessages = allHistory.filter((message) => !message.conversationId).map(messageFromRecord);
    setLegacyHistory(legacyMessages);
    if (conversationResult.status === 'rejected') setHistoryError(conversationResult.reason);
    if (conversationResult.status === 'fulfilled' && conversationResult.value.length) {
      await openConversation(conversationResult.value[0].id);
    } else if (historyResult.status === 'fulfilled') {
      setActiveId(null);
      setShowLegacyHistory(legacyMessages.length > 0);
      setMessages(allHistory.map(messageFromRecord));
    } else if (conversationResult.status === 'fulfilled') {
      setActiveId(null);
      setMessages([]);
    } else {
      setHistoryError(historyResult.reason);
    }
    setLoadingHistory(false);
  }, [openConversation, refreshConversations]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loadingConversation]);

  function startNewConversation() {
    requestSequence.current += 1;
    setActiveId(null);
    setMessages([]);
    setShowLegacyHistory(false);
    setLoadingHistory(false);
    setHistoryError(null);
    setDraft('');
    setMobileHistoryOpen(false);
    textareaRef.current?.focus();
  }

  async function sendQuestion(value = draft, retry = null) {
    const question = value.trim();
    if (!question || sending) return;
    const payload = retry || { question, requestId: requestId(), conversationId: activeId };
    const optimisticId = `pending-${payload.requestId}`;
    const localEntry = { id: optimisticId, question, answer: '', citations: [], agentsUsed: [], loading: true };
    setMessages((current) => retry
      ? current.map((message) => message.id === optimisticId ? localEntry : message)
      : [...current, localEntry]);
    setSending(true);
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = '';
    try {
      const result = await hrService.chat.send(payload);
      setActiveId(result.conversationId);
      setShowLegacyHistory(false);
      setMessages((current) => current.map((message) => message.id === optimisticId ? {
        id: result.messageId,
        question,
        answer: result.answer,
        citations: result.citations || [],
        agentsUsed: result.agentsUsed || [],
        resolved: result.resolved,
        escalationSuggested: result.escalationSuggested,
        escalated: result.escalated,
        intent: result.intent,
        createdAt: new Date().toISOString()
      } : message));
      await refreshConversations().catch(() => {});
    } catch (error) {
      setMessages((current) => current.map((message) => message.id === optimisticId ? {
        ...message,
        loading: false,
        failed: true,
        retryPayload: payload,
        answer: error.response?.data?.error || 'No pudimos completar la consulta. Comprueba tu conexión e inténtalo de nuevo.'
      } : message));
    } finally { setSending(false); }
  }

  function onComposerKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendQuestion();
    }
  }

  const selectedConversation = conversations.find((item) => item.id === activeId);

  return <>
    <PageHeader eyebrow="NEXOTICO IA" title="Asistente inteligente" description="Consulta políticas de RRHH y revisa tus propios registros de manera privada." action={<Button variant="secondary" icon="add" onClick={startNewConversation}>Nueva conversación</Button>} />
    <div className={`assistant-workspace ${mobileHistoryOpen ? 'history-open' : ''}`}>
      <aside className="conversation-sidebar" aria-label="Historial de conversaciones">
        <div className="conversation-sidebar-heading"><div><p className="eyebrow">TU ESPACIO</p><h2>Conversaciones</h2></div><Button variant="quiet" size="icon" icon="add" aria-label="Crear nueva conversación" onClick={startNewConversation} /></div>
        {loadingHistory ? <div className="conversation-skeleton" role="status"><span /><span /><span /></div> : historyError && !conversations.length ? <div className="conversation-error"><ResourceError error={historyError} onRetry={loadHistory} /></div> : conversations.length ? <div className="conversation-list">
          {conversations.map((conversation) => <button key={conversation.id} type="button" className={`conversation-item ${activeId === conversation.id ? 'selected' : ''}`} onClick={() => openConversation(conversation.id)} aria-current={activeId === conversation.id ? 'page' : undefined}>
            <MaterialIcon name="chat_bubble_outline" /><span className="conversation-item-text"><strong>{conversation.topic ? displayLabel(conversation.topic) : conversation.title}</strong><small>{formatDate(conversation.updatedAt)}</small></span>
          </button>)}
          {legacyHistory.length > 0 && <button type="button" className={`conversation-item ${showLegacyHistory ? 'selected' : ''}`} onClick={() => { requestSequence.current += 1; setActiveId(null); setShowLegacyHistory(true); setMessages(legacyHistory); setMobileHistoryOpen(false); }} aria-current={showLegacyHistory ? 'page' : undefined}><MaterialIcon name="history" /><span className="conversation-item-text"><strong>Consultas anteriores</strong><small>{legacyHistory.length} {legacyHistory.length === 1 ? 'mensaje' : 'mensajes'}</small></span></button>}
        </div> : <p className="history-empty">Tus conversaciones anteriores aparecerán aquí.</p>}
        <div className="conversation-privacy"><MaterialIcon name="lock" /><span>Tu historial es privado y solo tú puedes consultarlo.</span></div>
      </aside>
      <section className="assistant-panel" aria-label="Conversación con el asistente">
        <div className="assistant-panel-top"><button className="history-mobile-toggle" type="button" onClick={() => setMobileHistoryOpen((value) => !value)} aria-expanded={mobileHistoryOpen}><MaterialIcon name="history" /> Historial</button>
          <div className="assistant-conversation-label"><span className="assistant-online-dot" /><span>{showLegacyHistory ? 'Consultas anteriores' : selectedConversation?.topic ? displayLabel(selectedConversation.topic) : activeId ? 'Conversación guardada' : 'Nueva conversación'}</span></div>
          <span className="confidential-label"><MaterialIcon name="lock" />Privado</span>
        </div>
        <div className="chat-scroll-area" aria-live="polite" aria-busy={sending || loadingConversation}>
          {loadingConversation ? <div className="conversation-loading"><span /><span /><span /></div> : historyError && !messages.length ? <ResourceError error={historyError} onRetry={() => activeId ? openConversation(activeId) : loadHistory()} /> : messages.length ? <div className="message-thread">
            {messages.map((message) => <div className="message-pair" key={message.id}>
              <div className="user-message"><div className="user-message-label"><span className="user-avatar-small">T</span><strong>Tú</strong></div><p>{message.question}</p></div>
              <AssistantMessage message={message} onRetry={() => message.retryPayload && sendQuestion(message.retryPayload.question, message.retryPayload)} />
            </div>)}
            <div ref={bottomRef} />
          </div> : <div className="assistant-welcome">
            <span className="assistant-welcome-icon"><MaterialIcon name="auto_awesome" /></span>
            <p className="eyebrow">ASISTENTE DE PERSONAS Y CULTURA</p>
            <h2>¿En qué puedo ayudarte?</h2>
            <p>Respondo consultas con la documentación de RRHH y tus registros personales disponibles.</p>
            <div className="suggestion-grid">{suggestions.map((item) => <button type="button" key={item.text} className="suggestion-card" onClick={() => sendQuestion(item.text)} disabled={sending}><MaterialIcon name={item.icon} /><span>{item.text}</span><MaterialIcon name="arrow_outward" /></button>)}</div>
          </div>}
        </div>
        <div className="composer-area">
          <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); sendQuestion(); }}>
            <label className="sr-only" htmlFor="chat-question">Escribe tu consulta de Recursos Humanos</label>
            <textarea ref={textareaRef} id="chat-question" rows="1" maxLength="4000" placeholder="Escribe tu consulta…" value={draft} onChange={(event) => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`; }} onKeyDown={onComposerKeyDown} disabled={sending} />
            <div className="composer-bottom"><span><MaterialIcon name="keyboard_return" /> Enter para enviar · Shift + Enter para nueva línea</span><span className="composer-actions"><small>{draft.length}/4000</small><Button type="submit" size="icon" icon={sending ? 'progress_activity' : 'arrow_upward'} aria-label="Enviar consulta" disabled={sending || !draft.trim()} /></span></div>
          </form>
          <p className="assistant-disclaimer">Las respuestas se basan en fuentes disponibles. Confirma con RRHH cualquier caso particular.</p>
        </div>
      </section>
    </div>
  </>;
}
