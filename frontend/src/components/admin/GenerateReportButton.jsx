import { useState } from 'react';
import { Button } from '../ui/Button';
import { hrService } from '../../services/hrService';

export function GenerateReportButton({ onGenerated }) {
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  async function generateReport() {
    setGenerating(true);
    setFeedback('');
    setError('');
    try {
      const result = await hrService.reports.generate();
      if (!result?.report) throw new Error('El servidor no devolvió un reporte.');
      onGenerated?.(result.report);
      setFeedback(result.created ? 'Reporte generado y guardado.' : 'El reporte de hoy ya existía; se cargó el guardado.');
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'No se pudo generar el reporte. Inténtalo de nuevo.');
    } finally {
      setGenerating(false);
    }
  }

  return <div className="admin-generate-report">
    <Button type="button" icon={generating ? 'progress_activity' : 'summarize'} disabled={generating} onClick={generateReport}>
      {generating ? 'Generando reporte…' : 'Generar reporte de hoy'}
    </Button>
    {feedback && <span className="admin-generate-feedback" role="status">{feedback}</span>}
    {error && <span className="admin-generate-error" role="alert">{error}</span>}
  </div>;
}
