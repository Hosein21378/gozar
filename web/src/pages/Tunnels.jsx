import React from 'react'
import { api } from '../api.js'
import { Card, Btn, Field, Badge, Empty, Modal, Pick, Steps, Segmented, Bar, fmtBytes, relTime, Loader } from '../ui.jsx'
import PortEditor from '../PortEditor.jsx'
import { parsePorts, findConflicts } from '../ports.js'
import { Ic } from '../icons.jsx'

const TRANS = [
  { id: 'auto', label: 'خودکار', desc: 'همه مسیرها؛ هرکدام جواب داد', icon: Ic.Bolt },
  { id: 'private', label: 'اختصاصی', desc: 'رمزنگاری با کلید پنل + نقاب HTTPS', icon: Ic.Shield, tag: 'DPI' },
  { id: 'tcpmux', label: 'TCPMux', desc: 'سریع؛ استریم روی اتصال آماده', icon: Ic.Link },
  { id: 'tcp', label: 'TCP', desc: 'ساده و پایدار', icon: Ic.Link },
  { id: 'ws', label: 'WebSocket', desc: 'عبور از پروکسی و CDN', icon: Ic.Globe },
  { id: 'wss', label: 'WSS', desc: 'وب‌سوکت امن', icon: Ic.Lock },
  { id: 'quic', label: 'QUIC', desc: 'UDP سریع', icon: Ic.Bolt },
  { id: 'kcp', label: 'KCP', desc: 'UDP مقاوم', icon: Ic.Activity },
]
const PROFILES = [
  { id: 'balanced', label: 'متعادل', desc: 'تعادل سرعت و پایداری' },
  { id: 'gaming', label: 'گیمینگ', desc: 'تأخیر کمتر' },
  { id: 'ultraspeed', label: 'حداکثر سرعت', desc: 'پهنای باند بیشتر' },
]

function portCell(t) {
  const list = t.port_list || []
  if (!list.length) return <Badge kind="mute">خودکار</Badge>
  const shown = list.slice(0, 3)
  return (
    <div className="row" style={{ gap: 4, flexWrap: 'wrap', maxWidth: 200 }}>
      {shown.map((p, i) => (
        <span key={i} className="mono" style={{
          fontSize: 11.5, padding: '2px 7px', borderRadius: 7,
          background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.22)', color: '#7dd3fc'
        }}>{p.listen === p.target ? p.listen : `${p.listen}→${p.target}`}</span>
      ))}
      {list.length > shown.length && <Badge kind="info">+{list.length - shown.length}</Badge>}
    </div>
  )
}

export default function Tunnels({ toast, me, tick }) {
  const [list, setList] = React.useState(null)
  const [nodes, setNodes] = React.useState([])
  const [open, setOpen] = React.useState(false)
  const [edit, setEdit] = React.useState(null)

  const load = () => {
    api('GET', '/api/tunnels').then(setList).catch(e => toast.show(e.message, 'err'))
    api('GET', '/api/nodes').then(setNodes).catch(() => { })
  }
  React.useEffect(() => { load() }, [tick])

  async function del(t) {
    if (!confirm('حذف تونل «' + t.name + '»؟')) return
    try { await api('DELETE', '/api/tunnels/' + t.id); load(); toast.show('حذف شد') }
    catch (e) { toast.show(e.message, 'err') }
  }

  if (!list) return <Loader />

  const conn = list.filter(t => t.connected).length
  const total = list.length

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid g3">
        <Card className="stat">
          <div className="top">
            <div><div className="val">{conn}<span style={{ fontSize: 18, color: 'var(--dim)' }}> / {total}</span></div>
              <div className="lbl">تونل‌های متصل</div></div>
            <span className="ic g"><Ic.Link /></span>
          </div>
          <div className="foot"><Bar value={total ? (conn / total) * 100 : 0} tone="g" /></div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div><div className="val">{fmtBytes(list.reduce((a, t) => a + (t.bytes || 0), 0))}</div>
              <div className="lbl">ترافیک عبوری</div></div>
            <span className="ic b"><Ic.Activity /></span>
          </div>
          <div className="foot">مجموع همه تونل‌ها</div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div><div className="val">{list.filter(t => t.transport === 'private').length}</div>
              <div className="lbl">تونل اختصاصی</div></div>
            <span className="ic v"><Ic.Shield /></span>
          </div>
          <div className="foot">دارای نقاب ترافیک</div>
        </Card>
      </div>

      <Card>
        <div className="hd">
          <div><h3>همهٔ تونل‌ها</h3><div className="sub">{total} مسیر تعریف‌شده</div></div>
          <Btn icon={Ic.Plus} onClick={() => setOpen(true)} disabled={nodes.length < 2}>تونل جدید</Btn>
        </div>

        {total === 0
          ? <Empty icon={Ic.Tunnel}
            title={nodes.length < 2 ? 'اول دو سرور لازم است' : 'هنوز تونلی نساخته‌اید'}
            desc={nodes.length < 2 ? 'برای ساخت تونل باید حداقل دو سرور ثبت شده باشد.' : 'با دکمهٔ «تونل جدید» اولین مسیر عبور را بسازید.'}
            action={nodes.length >= 2 ? <Btn icon={Ic.Plus} onClick={() => setOpen(true)}>تونل جدید</Btn> : null} />
          : <div className="tbl-wrap">
            <table>
              <thead><tr><th>تونل</th><th>مسیر</th><th>ترانسپورت</th><th>پورت‌ها</th><th>ترافیک</th><th>وضعیت</th><th></th></tr></thead>
              <tbody>
                {list.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="row-name">
                        <span className="av" style={{ color: t.connected ? 'var(--acc)' : 'var(--dim)' }}><Ic.Tunnel style={{ width: 15, height: 15 }} /></span>
                        <span><b>{t.name}</b><small>{t.type === 'reverse' ? 'معکوس' : 'مستقیم'} · {t.profile || 'متعادل'}</small></span>
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{t.entry_name} <Ic.Arrow style={{ width: 11, height: 11, verticalAlign: -2, opacity: .5 }} /> {t.exit_name}</td>
                    <td>{t.transport === 'private'
                      ? <Badge kind="vio"><Ic.Shield style={{ width: 10, height: 10 }} /> اختصاصی</Badge>
                      : <span className="mono" style={{ fontSize: 12 }}>{t.transport}</span>}</td>
                    <td>{portCell(t)}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{fmtBytes(t.bytes)}</td>
                    <td>{t.connected
                      ? <Badge kind="ok" dot>متصل</Badge>
                      : <span><Badge kind="warn" dot>در انتظار</Badge>
                        {t.last_error && <div style={{ fontSize: 10.5, color: 'var(--dim2)', marginTop: 3, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.last_error}>{t.last_error}</div>}</span>}</td>
                    <td>{me.role === 'admin' &&
                      <div className="row" style={{ gap: 5 }}>
                        <button className="btn ghost xs" title="ویرایش پورت‌ها" onClick={() => setEdit(t)}><Ic.Edit /></button>
                        <button className="btn danger xs" title="حذف" onClick={() => del(t)}><Ic.Trash /></button>
                      </div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Card>

      {edit && <EditTunnel t={edit} list={list} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); toast.show('تونل به‌روزرسانی شد') }} toast={toast} />}
      {open && <Wizard nodes={nodes} list={list} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); toast.show('تونل ساخته شد') }} toast={toast} />}
    </div>
  )
}

function Wizard({ nodes, list, onClose, onDone, toast }) {
  const [step, setStep] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const [probe, setProbe] = React.useState(null)
  const [w, setW] = React.useState({
    name: '', entry: nodes[0]?.id || null, exit: null,
    dir: 'reverse', trans: 'auto', profile: 'balanced',
    protocol: 'tcp', ports: '', target: '127.0.0.1',
  })
  const set = (k, v) => setW({ ...w, [k]: v })
  const entry = nodes.find(n => n.id === w.entry)
  const exit = nodes.find(n => n.id === w.exit)

  async function runProbe() {
    setBusy(true); setProbe('run')
    try {
      const r = await api('POST', '/api/linktest', { source_node_id: w.entry, dest_node_id: w.exit })
      for (let i = 0; i < 60; i++) {
        await new Promise(res => setTimeout(res, 1500))
        const st = await api('GET', '/api/linktest/' + r.probe_id)
        if (st.done) { setProbe(st); break }
      }
      if (probe === 'run') setProbe(null)
    } catch (e) { toast.show(e.message, 'err'); setProbe(null) }
    setBusy(false)
  }

  async function create() {
    setBusy(true)
    try {
      await api('POST', '/api/tunnels', {
        name: w.name, type: w.dir, protocol: w.protocol, transport: w.trans,
        profile: w.profile, source_node_id: w.entry, dest_node_id: w.exit,
        ports: w.ports, target_host: w.target,
      })
      onDone()
    } catch (e) { toast.show(e.message, 'err') }
    setBusy(false)
  }

  const LABELS = ['سرورها', 'تنظیمات', 'پورت‌ها', 'بررسی']

  return (
    <Modal wide title="ساخت تونل جدید" sub="یک مسیر عبور بین دو سرور" onClose={onClose}
      footer={<>
        {step > 0 && <Btn kind="ghost" icon={Ic.Arrow} onClick={() => setStep(step - 1)}>قبلی</Btn>}
        <span className="spacer" />
        {step < 3
          ? <Btn onClick={() => setStep(step + 1)} disabled={step === 0 && (!w.name || !w.exit || w.exit === w.entry)}>بعدی</Btn>
          : <Btn icon={Ic.Check} onClick={create} disabled={busy}>{busy ? 'در حال ساخت…' : 'ساخت تونل'}</Btn>}
      </>}>

      <Steps list={LABELS} cur={step} />

      {step === 0 && (<>
        <Field label="نام تونل" hint="یک نام خوانا برای شناسایی این مسیر">
          <input value={w.name} onChange={e => set('name', e.target.value)} placeholder="مثلاً تونل اصلی HTTPS" autoFocus />
        </Field>
        <Field label="سرور ورودی (Entry)" hint="ترافیک از این سرور وارد می‌شود">
          <select value={w.entry || ''} onChange={e => set('entry', +e.target.value)}>
            {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </Field>
        <Field label="سرور خروجی (Exit)" hint="ترافیک از این سرور خارج می‌شود">
          <select value={w.exit || ''} onChange={e => set('exit', +e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {nodes.filter(n => n.id !== w.entry).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </Field>
        {w.exit && w.entry && (
          <div className="row" style={{ gap: 8, padding: '12px 14px', background: 'rgba(56,189,248,.07)', border: '1px solid rgba(56,189,248,.2)', borderRadius: 12 }}>
            <span style={{ color: 'var(--acc2)' }}><Ic.Info style={{ width: 15, height: 15 }} /></span>
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              مسیر: <b style={{ color: 'var(--txt)' }}>{entry?.name}</b> به <b style={{ color: 'var(--txt)' }}>{exit?.name}</b>
            </span>
          </div>
        )}
      </>)}

      {step === 1 && (<>
        <Field label="جهت تونل">
          <Segmented value={w.dir} onChange={v => set('dir', v)} options={[
            { id: 'reverse', label: 'معکوس' }, { id: 'forward', label: 'مستقیم' },
          ]} />
        </Field>
        <Field label="ترانسپورت" hint="روش عبور ترافیک بین دو سرور">
          <div className="pick" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {TRANS.map(t => (
              <div key={t.id} className={'opt' + (w.trans === t.id ? ' on' : '')} onClick={() => set('trans', t.id)}>
                <span className="ck"><Ic.Check /></span>
                <span className="oi" style={t.id === 'private' ? { color: 'var(--acc3)', borderColor: 'rgba(167,139,250,.3)', background: 'rgba(167,139,250,.1)' } : null}><t.icon /></span>
                <b>{t.label}{t.tag && <Badge kind="vio" >{t.tag}</Badge>}</b>
                <small>{t.desc}</small>
              </div>
            ))}
          </div>
        </Field>
        <Field label="پروفایل عملکرد">
          <Pick value={w.profile} onChange={v => set('profile', v)} options={PROFILES} />
        </Field>

        <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: 'rgba(0,0,0,.25)', border: '1px solid var(--line2)' }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <span style={{ color: 'var(--acc2)', display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 9, background: 'rgba(56,189,248,.12)' }}>
              <Ic.Wifi style={{ width: 16, height: 16 }} /></span>
            <div><b style={{ fontSize: 13.5 }}>محک اتصال</b>
              <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>همهٔ مسیرها را بین دو سرور تست می‌کند</div></div>
            <span className="spacer" />
            <Btn kind="ghost" className="sm" icon={Ic.Play} disabled={busy || !w.exit} onClick={runProbe}>
              {probe === 'run' ? 'در حال تست…' : 'اجرای تست'}
            </Btn>
          </div>

          {probe === 'run' && <div style={{ display: 'grid', gap: 8 }}>
            {TRANS.slice(1).map(t => <div key={t.id} className="skel" style={{ height: 30, borderRadius: 9 }} />)}
          </div>}

          {probe && probe !== 'run' && (
            <>
              <div className="tbl-wrap" style={{ margin: 0, padding: 0 }}>
                <table>
                  <thead><tr><th>مسیر</th><th>نتیجه</th><th>تأخیر / علت</th></tr></thead>
                  <tbody>
                    {(probe.results || []).map(r => (
                      <tr key={r.transport} style={probe.suggested === r.transport ? { background: 'rgba(52,211,153,.07)' } : null}>
                        <td><b>{TRANS.find(t => t.id === r.transport)?.label || r.transport}</b>
                          {probe.suggested === r.transport && <span style={{ marginRight: 6, fontSize: 11, color: 'var(--acc)' }}>پیشنهادی</span>}</td>
                        <td>{r.ok ? <Badge kind="ok" dot>متصل</Badge> : <Badge kind="err" dot>ناموفق</Badge>}</td>
                        <td className="mono dim" style={{ fontSize: 12 }}>{r.ok ? (r.rtt_ms ?? r.ms) + ' ms' : (r.error || '—')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {probe.suggested && probe.suggested !== w.trans &&
                <div className="row" style={{ marginTop: 12 }}>
                  <Btn className="sm" icon={Ic.Bolt} onClick={() => set('trans', probe.suggested)}>
                    استفاده از «{TRANS.find(t => t.id === probe.suggested)?.label}»
                  </Btn>
                </div>}
            </>
          )}
        </div>
      </>)}

      {step === 2 && (<>
        <Field label="پروتکل">
          <Segmented value={w.protocol} onChange={v => set('protocol', v)} options={[
            { id: 'tcp', label: 'TCP' }, { id: 'udp', label: 'UDP' }, { id: 'both', label: 'هر دو' },
          ]} />
        </Field>
        <Field label="پورت‌های این تونل" hint="هر تعداد پورت که می‌خواهید در همین یک تونل تعریف کنید">
          <PortEditor value={w.ports} onChange={v => set('ports', v)} tunnels={list} nodeId={w.entry} />
        </Field>
        <Field label="نشانی مقصد روی سرور خروجی">
          <input className="ltr" value={w.target} onChange={e => set('target', e.target.value)} placeholder="127.0.0.1" />
        </Field>
      </>)}

      {step === 3 && (<>
        <div style={{ display: 'grid', gap: 2 }}>
          {[
            ['نام تونل', w.name || '—'],
            ['سرور ورودی', entry?.name || '—'],
            ['سرور خروجی', exit?.name || '—'],
            ['جهت', w.dir === 'reverse' ? 'معکوس' : 'مستقیم'],
            ['ترانسپورت', TRANS.find(t => t.id === w.trans)?.label || w.trans],
            ['پروفایل', PROFILES.find(p => p.id === w.profile)?.label || w.profile],
            ['پروتکل', w.protocol.toUpperCase()],
            ['پورت‌ها', (() => { const pr = parsePorts(w.ports); return pr.list.length ? pr.list.length + ' پورت: ' + w.ports : 'خودکار' })()],
            ['مقصد', w.target],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="dim" style={{ fontSize: 13 }}>{k}</span>
              <b className="mono" style={{ fontSize: 13 }}>{String(v)}</b>
            </div>
          ))}
        </div>
        {w.trans === 'private' && (
          <div className="row" style={{ gap: 9, marginTop: 14, padding: '12px 14px', background: 'rgba(167,139,250,.08)', border: '1px solid rgba(167,139,250,.22)', borderRadius: 12, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--acc3)', marginTop: 2 }}><Ic.Shield style={{ width: 15, height: 15 }} /></span>
            <span style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.65 }}>
              ترانسپورت اختصاصی فعال است. پورت روی سرور ورودی به‌صورت تصادفی ساخته می‌شود و ترافیک با نقاب HTTPS از شناسایی عبور می‌کند.
            </span>
          </div>
        )}
      </>)}
    </Modal>
  )
}

/* ---------- ویرایش تونل موجود ---------- */
function EditTunnel({ t, list, onClose, onDone, toast }) {
  const [f, setF] = React.useState({
    name: t.name || '', transport: t.transport || 'auto',
    profile: t.profile || 'balanced', ports: t.ports || '', target_host: t.target_host || '127.0.0.1',
  })
  const [busy, setBusy] = React.useState(false)
  const pr = parsePorts(f.ports)
  const bad = !!pr.error || findConflicts(pr.list, list, t.source_node_id, t.id).length > 0

  async function save() {
    setBusy(true)
    try {
      await api('PUT', '/api/tunnels/' + t.id, f)
      onDone()
    } catch (e) { toast.show(e.message, 'err') }
    setBusy(false)
  }

  return (
    <Modal wide title={'ویرایش «' + t.name + '»'} sub="پورت‌ها و تنظیمات این تونل" onClose={onClose}
      footer={<>
        <Btn icon={Ic.Save} onClick={save} disabled={busy || bad}>{busy ? 'در حال ذخیره…' : 'ذخیره تغییرات'}</Btn>
        <Btn kind="ghost" onClick={onClose}>انصراف</Btn>
      </>}>
      <Field label="نام تونل">
        <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
      </Field>
      <Field label="پورت‌های این تونل" hint={`اکنون ${t.port_list?.length || 0} پورت روی این تونل تعریف شده`}>
        <PortEditor value={f.ports} onChange={v => setF({ ...f, ports: v })}
          tunnels={list} nodeId={t.source_node_id} skipId={t.id} />
      </Field>
      <Field label="نشانی مقصد روی سرور خروجی">
        <input className="ltr" value={f.target_host} onChange={e => setF({ ...f, target_host: e.target.value })} />
      </Field>
      <div className="grid g2" style={{ gap: 12 }}>
        <Field label="ترانسپورت">
          <select value={f.transport} onChange={e => setF({ ...f, transport: e.target.value })}>
            {TRANS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        <Field label="پروفایل">
          <select value={f.profile} onChange={e => setF({ ...f, profile: e.target.value })}>
            {PROFILES.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  )
}
