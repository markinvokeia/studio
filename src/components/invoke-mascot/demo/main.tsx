import * as React from 'react';
import { createRoot } from 'react-dom/client';
import {
  MascotPeekZone,
  MascotProvider,
  useMascot,
  useMascotRouteTravel,
  type MascotMood,
} from '../src';

type Page = 'agenda' | 'pacientes' | 'facturacion';
const PAGES: { id: Page; label: string }[] = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'pacientes', label: 'Pacientes' },
  { id: 'facturacion', label: 'Facturación' },
];

const PHASE_LABEL: Record<string, string> = {
  active: 'Atenta',
  traveling: 'Viajando',
  peeking: 'Escondida detrás de la barra',
  sleeping: 'Durmiendo (hibernando)',
};

function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'soft' }) {
  const { tone = 'soft', className, ...rest } = props;
  return <button type="button" className={`btn btn-${tone} ${className ?? ''}`} {...rest} />;
}

function ControlPanel() {
  const m = useMascot();
  const moods: { id: MascotMood; label: string }[] = [
    { id: 'neutral', label: 'Normal' },
    { id: 'happy', label: 'Feliz' },
    { id: 'thinking', label: 'Pensando' },
    { id: 'surprised', label: 'Sorpresa' },
    { id: 'sad', label: 'Triste' },
    { id: 'talking', label: 'Hablando' },
    { id: 'loading', label: 'Cargando' },
  ];
  const otherSide = () => {
    const r = document.querySelector('.ivm-actor')?.getBoundingClientRect();
    return r && r.left > window.innerWidth / 2 ? 'bottom-left' : 'bottom-right';
  };
  return (
    <aside className="panel" aria-label="Probar la mascota">
      <div className="panel-head">
        <div className="eyebrow">Probar la mascota</div>
        <div className="status">
          <span className={`dot dot-${m.phase}`} aria-hidden="true" /> {PHASE_LABEL[m.phase]}
        </div>
      </div>

      <h3>Estado de ánimo</h3>
      <div className="row">
        {moods.map((x) => (
          <Btn key={x.id} aria-pressed={m.mood === x.id} onClick={() => m.setMood(x.id)}>
            {x.label}
          </Btn>
        ))}
      </div>

      <h3>Gestos</h3>
      <div className="row">
        <Btn onClick={() => m.gesture('wave')}>Saludar</Btn>
        <Btn onClick={() => m.gesture('celebrate', 1800)}>Festejar</Btn>
        <Btn onClick={() => m.gesture('nod', 1400)}>Asentir</Btn>
        <Btn onClick={() => m.gesture('shake', 1200)}>Negar</Btn>
        <Btn onClick={() => m.say('¡Hola! Soy tu asistente de Invoke. ¿En qué te ayudo hoy?')}>Hablar</Btn>
      </div>

      <h3>Señalar (mira hacia donde señala)</h3>
      <div className="row">
        <Btn onClick={() => m.pointAt('#nuevo-turno', { say: 'Desde acá agendás un turno nuevo.' })}>Señalar “Nuevo turno”</Btn>
        <Btn onClick={() => m.pointAt('#buscador', { say: 'Buscá pacientes por nombre o cédula.', travel: 'hop' })}>Ir y señalar el buscador</Btn>
        <Btn onClick={() => m.pointAt('#widget-cobros', { say: 'Tenés cobros pendientes.' })}>Señalar un widget</Btn>
      </div>

      <h3>Moverse por la pantalla</h3>
      <div className="row">
        <Btn onClick={() => m.travelTo(otherSide(), { animation: 'teleport' })}>Salta, se desvanece y reaparece</Btn>
        <Btn onClick={() => m.travelTo(otherSide(), { animation: 'hop' })}>Saltitos</Btn>
        <Btn onClick={() => m.travelTo(otherSide(), { animation: 'jump' })}>Salto grande</Btn>
      </div>
      <p className="hint">Cambiar de página en el menú también la hace cruzar la pantalla.</p>

      <h3>Reposo y sueño</h3>
      <div className="row">
        <Btn onClick={() => m.hide()}>Esconderse detrás de la barra</Btn>
        <Btn onClick={() => m.show()}>Salir del escondite</Btn>
        <Btn onClick={() => m.sleep()}>Dormir</Btn>
        <Btn onClick={() => m.wake()}>Despertar</Btn>
      </div>
      <label className="switch">
        <input type="checkbox" checked={m.enabled} onChange={(e) => m.setEnabled(e.target.checked)} />
        <span>Mascota activada</span>
      </label>
      <p className="hint">
        En esta demo se esconde tras <b>10 s</b> sin uso y se duerme tras <b>2 min</b> sin pedidos (en la app: 45 s y 3 h).
      </p>
    </aside>
  );
}

function PageContent({ page }: { page: Page }) {
  if (page === 'agenda') {
    return (
      <>
        <div className="page-head">
          <h1>Agenda</h1>
          <a id="nuevo-turno" className="btn btn-primary" href="#nuevo">
            + Nuevo turno
          </a>
        </div>
        <div className="cards">
          {['09:00 · Limpieza', '10:30 · Ortodoncia (control)', '11:15 · Consulta inicial', '14:00 · Endodoncia'].map((t) => (
            <div key={t} className="card">
              <div className="card-time">{t.split(' · ')[0]}</div>
              <div className="card-title">{t.split(' · ')[1]}</div>
              <div className="card-sub">[Paciente] · Consultorio 1</div>
            </div>
          ))}
        </div>
      </>
    );
  }
  if (page === 'pacientes') {
    return (
      <>
        <div className="page-head">
          <h1>Pacientes</h1>
        </div>
        <label className="search">
          <span>Buscar paciente</span>
          <input id="buscador" placeholder="Nombre, cédula o teléfono" />
        </label>
        <div className="cards">
          {['[Paciente A]', '[Paciente B]', '[Paciente C]'].map((n) => (
            <div key={n} className="card">
              <div className="card-title">{n}</div>
              <div className="card-sub">Última visita: [fecha]</div>
            </div>
          ))}
        </div>
      </>
    );
  }
  return (
    <>
      <div className="page-head">
        <h1>Facturación</h1>
      </div>
      <div className="cards">
        <div className="card">
          <div className="card-title">Facturas del mes</div>
          <div className="card-sub">[datos de ejemplo]</div>
        </div>
        <div className="card">
          <div className="card-title">Cobros pendientes</div>
          <div className="card-sub">[datos de ejemplo]</div>
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const [page, setPage] = React.useState<Page>('agenda');
  // Al cambiar de página, la mascota cruza al otro lado de la pantalla.
  useMascotRouteTravel(page, { animation: 'cycle' });

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Invoke
        </div>
        <span className="topbar-note">Demo de la mascota</span>
      </header>
      <div className="body">
        <nav className="sidebar" aria-label="Menú principal">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`nav-item${page === p.id ? ' is-active' : ''}`}
              aria-current={page === p.id ? 'page' : undefined}
              onClick={() => setPage(p.id)}
            >
              {p.label}
            </button>
          ))}
        </nav>
        <main className="main">
          <div className="content">
            <section className="page">
              <PageContent page={page} />
            </section>
            <ControlPanel />
          </div>
          {/* La barra de widgets: la mascota se esconde DETRÁS y se asoma en reposo */}
          <MascotPeekZone edge="top" className="widgetbar-zone">
            <div className="widgetbar" role="region" aria-label="Widgets">
              <div className="widget">
                <b>12</b> turnos hoy
              </div>
              <div className="widget" id="widget-cobros">
                <b>3</b> cobros pendientes
              </div>
              <div className="widget">
                <b>5</b> mensajes de WhatsApp
              </div>
            </div>
          </MascotPeekZone>
        </main>
      </div>
    </div>
  );
}

function Demo() {
  return (
    <MascotProvider
      size={104}
      dock="bottom-right"
      insets={{ bottom: 64 }}
      idleAfterMs={10_000}
      sleepAfterMs={120_000}
      storageKey={null}
    >
      <AppShell />
    </MascotProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Demo />
  </React.StrictMode>,
);
