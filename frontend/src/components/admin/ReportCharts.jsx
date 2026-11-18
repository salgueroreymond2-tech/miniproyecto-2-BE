import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { EmptyState } from '../ui/Feedback';
import { MaterialIcon } from '../ui/MaterialIcon';

const COLORS = ['#14263C', '#385A7C', '#C4A574', '#327C61', '#8B9AAF', '#B7791F', '#7191AD'];
const axisStyle = { fontSize: 10, fill: '#687384' };

function ChartPanel({ icon, title, description, children }) {
  return <section className="surface-card admin-chart-card">
    <div className="admin-chart-heading"><span className="admin-chart-icon"><MaterialIcon name={icon} /></span><div><h2>{title}</h2><p>{description}</p></div></div>
    {children}
  </section>;
}

function NoChartData({ text = 'No hay datos en el reporte para mostrar este gráfico.' }) {
  return <div className="admin-chart-empty"><EmptyState icon="bar_chart" title="Sin datos" text={text} /></div>;
}

export function AbsenceTrendChart({ data = [] }) {
  const valid = data.filter((item) => item.date);
  return <ChartPanel icon="show_chart" title="Ausencias en 30 días" description="Personas únicas por día en el período del reporte.">
    {valid.length ? <div className="admin-chart-area"><ResponsiveContainer width="100%" height="100%"><LineChart data={valid} margin={{ top: 10, right: 16, left: -14, bottom: 2 }}>
      <CartesianGrid stroke="#E8ECF0" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="date" tick={axisStyle} tickLine={false} axisLine={false} interval={4} tickFormatter={(value) => String(value).slice(5)} />
      <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
      <Tooltip labelFormatter={(label) => `Fecha: ${label}`} formatter={(value) => [value, 'Personas ausentes']} contentStyle={{ border: '1px solid #DCE2E8', borderRadius: 8, fontSize: 12 }} />
      <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ fontSize: 11 }} />
      <Line name="Personas ausentes" type="monotone" dataKey="collaborators" stroke="#385A7C" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#C4A574', stroke: '#fff', strokeWidth: 2 }} />
    </LineChart></ResponsiveContainer></div> : <NoChartData />}
  </ChartPanel>;
}

export function AbsenceDepartmentChart({ data = [] }) {
  const totals = Object.values(data.reduce((result, item) => {
    result[item.department] = result[item.department] || { department: item.department, collaborators: 0 };
    result[item.department].collaborators += Number(item.collaborators || 0);
    return result;
  }, {})).sort((a, b) => b.collaborators - a.collaborators || a.department.localeCompare(b.department, 'es-CR'));
  return <ChartPanel icon="domain" title="Ausencias por departamento" description="Distribución según el reporte seleccionado.">
    {totals.some((item) => item.collaborators > 0) ? <div className="admin-chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={totals} margin={{ top: 8, right: 14, left: -16, bottom: 4 }}>
      <CartesianGrid stroke="#E8ECF0" strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="department" tick={axisStyle} tickLine={false} axisLine={false} interval={0} />
      <YAxis allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
      <Tooltip formatter={(value) => [value, 'Personas ausentes']} contentStyle={{ border: '1px solid #DCE2E8', borderRadius: 8, fontSize: 12 }} />
      <Legend verticalAlign="top" align="right" height={28} wrapperStyle={{ fontSize: 11 }} />
      <Bar name="Personas ausentes" dataKey="collaborators" fill="#385A7C" radius={[5, 5, 0, 0]} maxBarSize={44}>
        {totals.map((item, index) => <Cell key={item.department} fill={COLORS[index % COLORS.length]} />)}
      </Bar>
    </BarChart></ResponsiveContainer></div> : <NoChartData />}
  </ChartPanel>;
}

export function RequestStatusChart({ data = [] }) {
  const values = data.filter((item) => Number(item.count) > 0);
  return <ChartPanel icon="donut_small" title="Solicitudes por estado" description="Conteo almacenado en la fecha del reporte.">
    {values.length ? <div className="admin-chart-area"><ResponsiveContainer width="100%" height="100%"><PieChart>
      <Pie data={values} dataKey="count" nameKey="status" cx="50%" cy="48%" innerRadius={56} outerRadius={92} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`} labelLine={{ stroke: '#8995A3' }}>
        {values.map((item, index) => <Cell key={item.status} fill={COLORS[index % COLORS.length]} stroke="#fff" strokeWidth={2} />)}
      </Pie>
      <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ border: '1px solid #DCE2E8', borderRadius: 8, fontSize: 12 }} />
      <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
    </PieChart></ResponsiveContainer></div> : <NoChartData text="No hay solicitudes registradas en el reporte." />}
  </ChartPanel>;
}

export function TopicChart({ data = [] }) {
  const values = data.slice(0, 5).filter((item) => Number(item.count) > 0);
  return <ChartPanel icon="forum" title="Temas más consultados" description="Hasta cinco temas del día anterior al reporte.">
    {values.length ? <div className="admin-chart-area admin-chart-topics"><ResponsiveContainer width="100%" height="100%"><BarChart data={values} layout="vertical" margin={{ top: 4, right: 22, left: 12, bottom: 4 }}>
      <CartesianGrid stroke="#E8ECF0" strokeDasharray="3 3" horizontal={false} />
      <XAxis type="number" allowDecimals={false} tick={axisStyle} tickLine={false} axisLine={false} />
      <YAxis type="category" dataKey="topic" width={112} tick={axisStyle} tickLine={false} axisLine={false} />
      <Tooltip formatter={(value) => [value, 'Consultas']} contentStyle={{ border: '1px solid #DCE2E8', borderRadius: 8, fontSize: 12 }} />
      <Legend verticalAlign="top" align="right" height={26} wrapperStyle={{ fontSize: 11 }} />
      <Bar name="Consultas" dataKey="count" fill="#C4A574" radius={[0, 5, 5, 0]} maxBarSize={24} />
    </BarChart></ResponsiveContainer></div> : <NoChartData text="No se registraron temas consultados en ese día." />}
  </ChartPanel>;
}
