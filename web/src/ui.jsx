import React from 'react'
import { Ic } from './icons.jsx'

/* ---------- توست ---------- */
export function useToast() {
  const [items, setItems] = React.useState([])
  const show = React.useCallback((msg, kind = 'ok') => {
    const id = Math.random()
    setItems(s => [...s, { id, msg, kind }])
    setTimeout(() => setItems(s => s.filter(i => i.id !== id)), 3600)
  }, [])
  const el = React.createElement('div', { className: 'toasts' },
    items.map(i => React.createElement('div', { key: i.id, className: 'toast ' + i.kind },
      React.createElement(i.kind === 'err' ? Ic.Alert : i.kind === 'info' ? Ic.Info : Ic.Check),
      React.createElement('span', null, i.msg))))
  return { show, el }
}

/* ---------- ابزارها ---------- */
export function fmtBytes(b) {
  b = Number(b) || 0
  if (b < 1024) return b + ' B'
  const u = ['KB', 'MB', 'GB', 'TB', 'PB']
  let i = -1
  do { b /= 1024; i++ } while (b >= 1024 && i < u.length - 1)
  return b.toFixed(b < 10 ? 1 : 0) + ' ' + u[i]
}
export function fmtNum(n) {
  n = Number(n) || 0
  return n.toLocaleString('en-US')
}
export function relTime(s) {
  if (!s) return 'هرگز'
  const d = new Date(s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z'))
  if (isNaN(d)) return s
  const sec = Math.floor((Date.now() - d) / 1000)
  if (sec < 0) return 'اکنون'
  if (sec < 60) return sec + ' ثانیه پیش'
  if (sec < 3600) return Math.floor(sec / 60) + ' دقیقه پیش'
  if (sec < 86400) return Math.floor(sec / 3600) + ' ساعت پیش'
  return Math.floor(sec / 86400) + ' روز پیش'
}

/* ---------- پایه ---------- */
export const Card = ({ children, className = '', ...p }) =>
  React.createElement('div', { className: 'card ' + className, ...p }, children)

export const Btn = ({ children, kind = 'primary', icon, ...p }) =>
  React.createElement('button', { className: 'btn ' + kind, ...p },
    icon ? React.createElement(icon) : null, children)

export const Field = ({ label, hint, children }) =>
  React.createElement('label', { className: 'field' },
    React.createElement('span', { className: 'field-label' }, label),
    children,
    hint ? React.createElement('span', { className: 'hint' }, hint) : null)

export const Badge = ({ kind = 'mute', dot, children }) =>
  React.createElement('span', { className: 'badge ' + kind },
    dot ? React.createElement('span', { className: 'd' }) : null, children)

export const Spinner = () => React.createElement('div', { className: 'spin' })
export const Loader = () => React.createElement('div', { className: 'center' }, React.createElement(Spinner))

export function Empty({ icon = Ic.Inbox, title, desc, action }) {
  return React.createElement('div', { className: 'empty' },
    React.createElement('div', { className: 'ic' }, React.createElement(icon)),
    React.createElement('b', null, title),
    desc ? React.createElement('p', null, desc) : null,
    action)
}

export function Bar({ value, tone = 'g' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  return React.createElement('div', { className: 'bar' },
    React.createElement('i', { className: tone, style: { width: v + '%' } }))
}

export function Segmented({ value, onChange, options }) {
  return React.createElement('div', { className: 'seg' },
    options.map(o => React.createElement('button', {
      key: o.id, className: value === o.id ? 'on' : '',
      onClick: () => onChange(o.id)
    }, o.label)))
}

export function Switch({ checked, onChange, label }) {
  return React.createElement('label', { className: 'switch' },
    React.createElement('input', { type: 'checkbox', checked, onChange: e => onChange(e.target.checked) }),
    React.createElement('span', { className: 'track' }),
    label ? React.createElement('span', { style: { fontSize: 13 } }, label) : null)
}

/* ---------- مودال ---------- */
export function Modal({ title, sub, onClose, children, footer, wide }) {
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return React.createElement('div', { className: 'overlay', onMouseDown: e => e.target === e.currentTarget && onClose() },
    React.createElement('div', { className: 'modal' + (wide ? ' wide' : '') },
      React.createElement('div', { className: 'mh' },
        React.createElement('div', null,
          React.createElement('h3', null, title),
          sub ? React.createElement('p', null, sub) : null),
        React.createElement('button', { className: 'icon-btn', onClick: onClose }, React.createElement(Ic.X))),
      React.createElement('div', { className: 'mb' }, children),
      footer ? React.createElement('div', { className: 'mf' }, footer) : null))
}

/* ---------- استپر ---------- */
export function Steps({ list, cur }) {
  return React.createElement('div', { className: 'steps' },
    list.map((label, i) => React.createElement(React.Fragment, { key: i },
      i > 0 ? React.createElement('span', { className: 'ln' + (i <= cur ? ' done' : '') }) : null,
      React.createElement('div', { className: 's' + (i === cur ? ' on' : '') + (i < cur ? ' done' : '') },
        React.createElement('span', { className: 'n' }, i < cur ? React.createElement(Ic.Check, { style: { width: 13, height: 13 } }) : i + 1),
        React.createElement('span', { className: 't' }, label)))))
}

/* ---------- انتخاب‌گر کارت‌مانند ---------- */
export function Pick({ options, value, onChange, cols }) {
  return React.createElement('div', { className: 'pick', style: cols ? { gridTemplateColumns: `repeat(${cols},1fr)` } : null },
    options.map(o => React.createElement('div', {
      key: o.id, className: 'opt' + (value === o.id ? ' on' : ''), onClick: () => onChange(o.id)
    },
      React.createElement('span', { className: 'ck' }, React.createElement(Ic.Check)),
      o.icon ? React.createElement('span', { className: 'oi' }, React.createElement(o.icon)) : null,
      React.createElement('b', null, o.label),
      o.desc ? React.createElement('small', null, o.desc) : null)))
}

/* ---------- کپی ---------- */
export function Code({ children, copy = true }) {
  const [ok, setOk] = React.useState(false)
  const go = async () => {
    try { await navigator.clipboard.writeText(children); setOk(true); setTimeout(() => setOk(false), 1400) } catch (e) { }
  }
  return React.createElement('div', { className: 'token-box' },
    React.createElement('code', null, children),
    copy ? React.createElement('button', { className: 'cp', onClick: go, title: 'کپی' },
      React.createElement(ok ? Ic.Check : Ic.Copy)) : null)
}

/* ---------- نمودار خطی ---------- */
export function Area({ data, h = 150, color = '#34d399', color2 = '#38bdf8' }) {
  const d = (data && data.length) ? data : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const max = Math.max(...d, 1)
  const W = 600, H = h, pad = 4
  const pts = d.map((v, i) => [
    pad + (i / Math.max(1, d.length - 1)) * (W - pad * 2),
    H - pad - (v / max) * (H - pad * 2 - 10)
  ])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = line + ` L ${pts[pts.length - 1][0].toFixed(1)} ${H} L ${pts[0][0].toFixed(1)} ${H} Z`
  const gid = 'g' + Math.random().toString(36).slice(2, 8)
  return React.createElement('svg', { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', style: { width: '100%', height: H, display: 'block' } },
    React.createElement('defs', null,
      React.createElement('linearGradient', { id: gid, x1: '0', y1: '0', x2: '0', y2: '1' },
        React.createElement('stop', { offset: '0%', stopColor: color, stopOpacity: .38 }),
        React.createElement('stop', { offset: '100%', stopColor: color, stopOpacity: 0 })),
      React.createElement('linearGradient', { id: gid + 's', x1: '0', y1: '0', x2: '1', y2: '0' },
        React.createElement('stop', { offset: '0%', stopColor: color }),
        React.createElement('stop', { offset: '100%', stopColor: color2 }))),
    React.createElement('path', { d: area, fill: `url(#${gid})` }),
    React.createElement('path', { d: line, fill: 'none', stroke: `url(#${gid}s)`, strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' }),
    React.createElement('circle', { cx: pts[pts.length - 1][0], cy: pts[pts.length - 1][1], r: 4, fill: '#fff' }))
}

/* ---------- حلقه درصد ---------- */
export function Ring({ value, size = 62, label }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0))
  const r = (size - 8) / 2, c = 2 * Math.PI * r
  return React.createElement('div', { style: { position: 'relative', width: size, height: size, flex: '0 0 ' + size + 'px' } },
    React.createElement('svg', { width: size, height: size, style: { transform: 'rotate(-90deg)' } },
      React.createElement('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'rgba(255,255,255,.09)', strokeWidth: 5 }),
      React.createElement('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: v > 80 ? '#fb7185' : v > 60 ? '#fbbf24' : '#34d399',
        strokeWidth: 5, strokeLinecap: 'round', strokeDasharray: `${(v / 100) * c} ${c}`, style: { transition: 'stroke-dasharray .6s ease' } })),
    React.createElement('div', { style: { position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 700 } }, label ?? Math.round(v) + '%'))
}
