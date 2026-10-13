import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fields, getTuning, resetTuning, setTuning, subscribeTuning, tuningJSON } from './LiveTuning';
import './test-settings.css';

type Stats = { fps: number; drawCalls: number; triangles: number; geometries: number; textures: number };
type Props = {
  onClose: () => void;
  onCollapseChange?: (collapsed: boolean) => void;
  onAction?: (action: string) => void;
  getStats?: () => Stats;
};
type Field = (typeof fields)[number];

function NumberSetting({ field, value }: { field: Field; value: number }) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(String(value)); }, [value]);
  return <div className={`test-setting ${value !== field.defaultValue ? 'is-changed' : ''}`}>
    <label htmlFor={`test-setting-${field.key}`} title={field.key}>{field.label}</label>
    <div className="test-setting-edit">
      <input id={`test-setting-${field.key}`} type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
        aria-label={field.label} role="spinbutton" aria-valuemin={field.min} aria-valuemax={field.max} aria-valuenow={value} value={draft}
        onFocus={() => { focused.current = true; }}
        onChange={event => {
          const next = event.target.value;
          if (!/^[+-]?(?:\d*(?:\.\d*)?)?$/.test(next)) return;
          setDraft(next);
          if (next.trim() && Number.isFinite(Number(next))) setTuning(field.key, Number(next));
        }}
        onBlur={() => { focused.current = false; setDraft(String(getTuning()[field.key] ?? field.defaultValue)); }}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const next = Math.min(field.max, Math.max(field.min, value + field.step * (event.key === 'ArrowUp' ? 1 : -1)));
            setTuning(field.key, next); setDraft(String(getTuning()[field.key] ?? next));
          }
        }} />
      <button type="button" className="test-setting-reset" aria-label={`Reset ${field.label}`} title={`Reset to ${field.defaultValue}`}
        onClick={() => { resetTuning(field.key); setDraft(String(field.defaultValue)); }}>↺</button>
    </div>
    <span className="test-setting-range">{field.min} – {field.max} · step {field.step}</span>
  </div>;
}

export function TestSettings({ onClose, onCollapseChange, onAction, getStats }: Props) {
  // Subscribe to a primitive snapshot so stores that return fresh objects cannot loop.
  const snapshot = useSyncExternalStore(subscribeTuning, tuningJSON, tuningJSON);
  const values = JSON.parse(snapshot).settings as Record<string, number>;
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');
  const [changedOnly, setChangedOnly] = useState(false);
  const [status, setStatus] = useState('');
  const [fallbackJSON, setFallbackJSON] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!getStats) return;
    const update = () => setStats(getStats());
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [getStats]);
  useEffect(() => { if (fallbackJSON) fallbackRef.current?.select(); }, [fallbackJSON]);
  const collapse = (next: boolean) => { setCollapsed(next); onCollapseChange?.(next); };
  const copy = async () => {
    const json = tuningJSON();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(json);
      setFallbackJSON(''); setStatus('JSON copied.');
    } catch {
      setFallbackJSON(json); setStatus('Select JSON below and copy with your device’s copy command.');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([tuningJSON()], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'blacktop-test-settings.json';
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('JSON downloaded.');
  };
  const importJSON = () => {
    try {
      const parsed: unknown = JSON.parse(importText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Use a JSON object of setting names and numbers.');
      const envelope=parsed as Record<string,unknown>;const incoming=(envelope.settings&&typeof envelope.settings==='object'?envelope.settings:envelope) as Record<string, unknown>;
      const updates = fields.filter(field => Object.prototype.hasOwnProperty.call(incoming, field.key));
      if (!updates.length) throw new Error('No recognized settings found.');
      if (updates.some(field => typeof incoming[field.key] !== 'number' || !Number.isFinite(incoming[field.key]))) throw new Error('Every recognized setting must contain a finite number.');
      updates.forEach(field => setTuning(field.key, incoming[field.key] as number));
      setImportOpen(false); setImportText(''); setStatus(`Imported ${updates.length} settings.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Invalid JSON.'); }
  };
  const visible = fields.filter(field => {
    const matches = `${field.label} ${field.key} ${field.group}`.toLowerCase().includes(search.toLowerCase());
    return matches && (!changedOnly || (values[field.key] ?? field.defaultValue) !== field.defaultValue);
  });
  const groups = Array.from(new Set(visible.map(field => field.group)));
  const isolate = (event: React.SyntheticEvent) => event.stopPropagation();
  const fps = stats ? Math.round(stats.fps) : '—';

  if (collapsed) return <div className="test-settings-pill" onKeyDown={isolate} onKeyUp={isolate} onPointerDown={isolate} onPointerUp={isolate} onClick={isolate}>
    <button type="button" onClick={() => collapse(false)} aria-label="Expand test settings">TEST <span>{fps} FPS</span> <span aria-hidden="true">⌃</span></button>
    <button type="button" onClick={onClose} aria-label="Close test settings">×</button>
  </div>;

  return <section className="test-settings-panel" aria-label="Live test settings" onKeyDown={isolate} onKeyUp={isolate} onPointerDown={isolate} onPointerUp={isolate} onClick={isolate} onWheel={isolate}>
    <header className="test-settings-header">
      <div><h2>TEST SETTINGS</h2><p>Live changes · saved automatically</p></div>
      <div className="test-settings-window-actions"><button type="button" onClick={() => collapse(true)} aria-label="Minimize test settings">−</button><button type="button" onClick={onClose} aria-label="Close test settings">×</button></div>
    </header>
    <div className="test-settings-stats"><strong>{fps} FPS</strong>{stats && <span>{stats.drawCalls} draws · {Math.round(stats.triangles).toLocaleString()} tris · {stats.geometries} geo · {stats.textures} tex</span>}<span className="test-settings-running">GAME RUNNING</span></div>
    <div className="test-settings-filters"><input type="search" aria-label="Search test settings" placeholder="Search settings or groups…" value={search} onChange={event => setSearch(event.target.value)} /><label><input type="checkbox" checked={changedOnly} onChange={event => setChangedOnly(event.target.checked)} /> Changed only</label></div>
    <div className="test-settings-scroll">
      {onAction && <div className="test-settings-test-actions"><h3>TEST ACTIONS</h3><div>{[['day', 'DAY'], ['night', 'NIGHT'], ['repair', 'REPAIR'], ['heal', 'HEAL'], ['loseHeat', 'LOSE HEAT']].map(([action, label]) => <button type="button" key={action} onClick={() => { onAction(action); setStatus(`${label} test action applied.`); }}>{label}</button>)}</div></div>}
      {groups.map(group => <section className="test-settings-group" key={group}><h3>{group}</h3><div className="test-settings-grid">{visible.filter(field => field.group === group).map(field => <NumberSetting key={field.key} field={field} value={values[field.key] ?? field.defaultValue} />)}</div></section>)}
      {!visible.length && <p className="test-settings-empty">No matching settings.</p>}
      {fallbackJSON && <label className="test-settings-json">Copy settings JSON<textarea ref={fallbackRef} readOnly value={fallbackJSON} onFocus={event => event.currentTarget.select()} /></label>}
      {importOpen && <div className="test-settings-import"><label className="test-settings-json">Paste settings JSON<textarea value={importText} onChange={event => setImportText(event.target.value)} placeholder={'{"settingName": 1}'} /></label><button type="button" onClick={importJSON}>APPLY JSON</button><button type="button" onClick={() => setImportOpen(false)}>CANCEL</button></div>}
    </div>
    <footer className="test-settings-footer"><div><button type="button" onClick={copy}>COPY JSON</button><button type="button" onClick={download}>DOWNLOAD</button><button type="button" onClick={() => setImportOpen(value => !value)}>IMPORT</button><button type="button" className="test-settings-reset-all" onClick={() => { resetTuning(); setStatus('All settings reset to defaults.'); }}>RESET ALL</button></div><p role="status" aria-live="polite">{status || `${fields.length} settings · changes apply immediately`}</p></footer>
  </section>;
}

export default TestSettings;
