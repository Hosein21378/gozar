import React from 'react'
import { parsePorts, buildSpec, findConflicts } from './ports.js'
import { Ic } from './icons.jsx'
import { Badge } from './ui.jsx'

/* ویرایشگر پورت‌ها: چند پورت در یک تونل
   - ردیف‌های گرافیکی (پورت گوش‌دادن -> پورت مقصد)
   - حالت متنی برای کاربر حرفه‌ای
   - اعتبارسنجی زنده + تشخیص تداخل با تونل‌های دیگرِ همان سرور */
export default function PortEditor({ value, onChange, tunnels = [], nodeId, skipId }) {
  const [raw, setRaw] = React.useState(false)
  const [text, setText] = React.useState('')

  React.useEffect(() => { setText(value || '') }, [value])

  const parsed = React.useMemo(() => parsePorts(raw ? text : (value || '')), [raw, text, value])
  const rows = parsed.list
  const conflicts = React.useMemo(() => findConflicts(rows, tunnels, nodeId, skipId), [rows, tunnels, nodeId, skipId])

  const commit = (list) => onChange(buildSpec(list))
  const isConflict = (p) => conflicts.includes(p)

  const setRow = (i, field, v) => {
    const next = rows.map((r, k) => k === i ? { ...r, [field]: v } : r)
    // اگر ویرایش مستقیم رشته است، از حالت متنی استفاده کن تا رشته بازسازی نشود
    commit(next)
  }
  const addRow = () => {
    let p = 3080
    const used = new Set(rows.map(r => r.listen))
    while (used.has(p) && p < 65000) p++
    commit([...rows, { listen: p, target: p }])
  }
  const delRow = (i) => commit(rows.filter((_, k) => k !== i))
  const addRange = () => {
    const start = rows.length ? Math.max(...rows.map(r => r.listen)) + 1 : 3080
    commit([...rows, ...[0, 1, 2].map(k => ({ listen: start + k, target: start + k }))])
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 9 }}>
        <div className="row" style={{ gap: 8 }}>
          <Badge kind={rows.length ? 'info' : 'mute'}>{rows.length ? `${rows.length} پورت` : 'خودکار'}</Badge>
          {conflicts.length > 0 && <Badge kind="err"><Ic.Alert style={{ width: 10, height: 10 }} /> تداخل</Badge>}
        </div>
        <button className="btn ghost xs" onClick={() => { setText(value || ''); setRaw(!raw) }}>
          {raw ? 'حالت گرافیکی' : 'حالت متنی'}
        </button>
      </div>

      {raw ? (
        <>
          <input className="ltr" value={text} onChange={e => { setText(e.target.value); onChange(e.target.value) }}
            placeholder="443,2053=53,8000-8010" />
          <span className="hint" style={{ display: 'block', marginTop: 6, color: 'var(--dim2)', fontSize: 11.5 }}>
            قالب‌ها: <span className="mono">80,443</span> چند پورت · <span className="mono">8000-8010</span> بازه · <span className="mono">2053=53</span> نگاشت
          </span>
        </>
      ) : (
        <>
          <div className="port-rows">
            {rows.length === 0 && (
              <div className="port-empty" onClick={addRow}>
                <Ic.Plus style={{ width: 14, height: 14 }} />
                <span>هیچ پورتی تعریف نشده — برای افزودن کلیک کنید</span>
              </div>
            )}
            {rows.map((r, i) => (
              <div key={i} className={'port-row' + (isConflict(r.listen) ? ' bad' : '')}>
                <input className="ltr" type="number" min="1" max="65535" value={r.listen}
                  onChange={e => setRow(i, 'listen', Math.max(1, Math.min(65535, +e.target.value || 0)))} />
                <span className="arr"><Ic.Arrow style={{ width: 13, height: 13 }} /></span>
                <input className="ltr" type="number" min="1" max="65535" value={r.target}
                  onChange={e => setRow(i, 'target', Math.max(1, Math.min(65535, +e.target.value || 0)))} />
                <button className="port-del" onClick={() => delRow(i)} title="حذف"><Ic.X style={{ width: 12, height: 12 }} /></button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 9, gap: 7 }}>
            <button className="btn ghost xs" onClick={addRow}><Ic.Plus style={{ width: 12, height: 12 }} /> پورت</button>
            <button className="btn ghost xs" onClick={addRange}><Ic.Plus style={{ width: 12, height: 12 }} /> بازهٔ ۳تایی</button>
            {rows.length > 0 && <button className="btn ghost xs" onClick={() => commit([])}>پاک کردن همه</button>}
          </div>
        </>
      )}

      {parsed.error && (
        <div className="port-msg err"><Ic.Alert style={{ width: 13, height: 13 }} />{parsed.error}</div>
      )}
      {!parsed.error && conflicts.length > 0 && (
        <div className="port-msg warn">
          <Ic.Alert style={{ width: 13, height: 13 }} />
          پورت‌های <b className="mono" style={{ margin: '0 3px' }}>{conflicts.join('، ')}</b>
          روی این سرور قبلاً به تونل دیگری داده شده‌اند.
        </div>
      )}
      {!parsed.error && rows.length > 20 && (
        <div className="port-msg info"><Ic.Info style={{ width: 13, height: 13 }} />
          {rows.length} پورت روی یک تونل — هر پورت یک اتصال جداگانه باز می‌کند.</div>
      )}

      <span className="hint" style={{ display: 'block', marginTop: 9, color: 'var(--dim2)', fontSize: 11.5, lineHeight: 1.6 }}>
        سمت راست = پورتی که روی <b>سرور ورودی</b> باز می‌شود؛ سمت چپ = پورتی که روی <b>سرور خروجی</b> تحویل می‌دهد.
        اگر هر دو یکی باشد، همان پورت منتقل می‌شود.
      </span>
    </div>
  )
}
