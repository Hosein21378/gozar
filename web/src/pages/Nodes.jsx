import React from 'react'
import { api } from '../api.js'
import { Card, Btn, Field, Badge, Empty, Bar, Modal, Code, fmtBytes, relTime, Loader } from '../ui.jsx'
import { Ic } from '../icons.jsx'

export default function Nodes({ toast, me, tick }) {
  const [nodes, setNodes] = React.useState(null)
  const [open, setOpen] = React.useState(false)
  const [join, setJoin] = React.useState(null)
  const [f, setF] = React.useState({ name: '', host: '' })
  const [busy, setBusy] = React.useState(false)

  const load = () => api('GET', '/api/nodes').then(setNodes).catch(e => toast.show(e.message, 'err'))
  React.useEffect(() => { load() }, [tick])

  async function add(e) {
    e.preventDefault(); setBusy(true)
    try {
      const n = await api('POST', '/api/nodes', { name: f.name, host: f.host })
      setJoin(n); setOpen(false); setF({ name: '', host: '' }); load()
      toast.show('سرور «' + n.name + '» ساخته شد')
    } catch (err) { toast.show(err.message, 'err') }
    setBusy(false)
  }
  async function del(n) {
    if (!confirm('حذف سرور «' + n.name + '»؟ تونل‌های مرتبط هم حذف می‌شوند.')) return
    try { await api('DELETE', '/api/nodes/' + n.id); load(); toast.show('حذف شد') }
    catch (err) { toast.show(err.message, 'err') }
  }

  if (!nodes) return <Loader />

  const online = nodes.filter(n => n.online).length
  const install = join ? `bash <(curl -fsSL https://raw.githubusercontent.com/Hosein21378/gozar/main/scripts/install.sh) --agent ${join.token}` : ''

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* هدر آماری */}
      <div className="grid g3">
        <Card className="stat">
          <div className="top">
            <div><div className="val">{online}<span style={{ fontSize: 18, color: 'var(--dim)' }}> / {nodes.length}</span></div>
              <div className="lbl">سرورهای آنلاین</div></div>
            <span className="ic g"><Ic.Server /></span>
          </div>
          <div className="foot">
            <Bar value={nodes.length ? (online / nodes.length) * 100 : 0} tone="g" />
          </div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div><div className="val">{nodes.reduce((a, n) => a + (n.relay_port ? 1 : 0), 0)}</div>
              <div className="lbl">پورت رله فعال</div></div>
            <span className="ic b"><Ic.Globe /></span>
          </div>
          <div className="foot">هر سرور یک پورت تصادفی برای ترانسپورت اختصاصی دارد</div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div>
              <div className="val">{Math.round(nodes.reduce((a, n) => a + (n.cpu_percent || 0), 0) / Math.max(1, nodes.length))}%</div>
              <div className="lbl">میانگین بار پردازنده</div></div>
            <span className="ic v"><Ic.Cpu /></span>
          </div>
          <div className="foot">در سراسر شبکه</div>
        </Card>
      </div>

      <Card>
        <div className="hd">
          <div><h3>فهرست سرورها</h3><div className="sub">{nodes.length} سرور ثبت‌شده</div></div>
          {me.role === 'admin' && <Btn icon={Ic.Plus} onClick={() => setOpen(true)}>افزودن سرور</Btn>}
        </div>

        {nodes.length === 0
          ? <Empty icon={Ic.Server} title="هنوز سروری ثبت نشده"
            desc="اولین سرور را اضافه کنید تا دستور اتصالش را بگیرید."
            action={me.role === 'admin' && <Btn icon={Ic.Plus} onClick={() => setOpen(true)}>افزودن سرور</Btn>} />
          : <div className="tbl-wrap">
            <table>
              <thead><tr>
                <th>سرور</th><th>نشانی</th><th>پردازنده</th><th>حافظه</th><th>پورت اختصاصی</th><th>نسخه</th><th>وضعیت</th><th></th>
              </tr></thead>
              <tbody>
                {nodes.map(n => {
                  const mem = n.mem_total_bytes ? (n.mem_used_bytes / n.mem_total_bytes) * 100 : 0
                  return (
                    <tr key={n.id}>
                      <td>
                        <div className="row-name">
                          <span className="av" style={{ color: n.online ? 'var(--acc)' : 'var(--dim)' }}><Ic.Server style={{ width: 15, height: 15 }} /></span>
                          <span><b>{n.name}</b><small>{n.os_info || 'سیستم‌عامل نامشخص'}</small></span>
                        </div>
                      </td>
                      <td className="mono dim" style={{ fontSize: 12.5 }}>{n.reported_ip || n.host || n.observed_ip || '—'}</td>
                      <td style={{ minWidth: 96 }}>
                        <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <b className="mono">{Math.round(n.cpu_percent || 0)}%</b>
                        </div>
                        <Bar value={n.cpu_percent} tone={(n.cpu_percent || 0) > 80 ? 'r' : (n.cpu_percent || 0) > 55 ? 'y' : 'g'} />
                      </td>
                      <td style={{ minWidth: 110 }}>
                        <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                          <b className="mono">{fmtBytes(n.mem_used_bytes)}</b>
                        </div>
                        <Bar value={mem} tone={mem > 85 ? 'r' : mem > 65 ? 'y' : 'g'} />
                      </td>
                      <td className="mono" style={{ fontSize: 12.5 }}>
                        {n.private_port ? <Badge kind="vio">{n.private_port}</Badge> : <span className="dim">—</span>}
                      </td>
                      <td className="dim" style={{ fontSize: 12.5 }}>{n.agent_version ? 'v' + n.agent_version : '—'}</td>
                      <td>{n.online
                        ? <span><Badge kind="ok" dot>آنلاین</Badge><div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 3 }}>{relTime(n.last_seen)}</div></span>
                        : <span><Badge kind="err" dot>آفلاین</Badge><div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 3 }}>{relTime(n.last_seen)}</div></span>}
                      </td>
                      <td>{me.role === 'admin' &&
                        <div className="row" style={{ gap: 5 }}>
                          <button className="btn ghost xs" title="دستور اتصال" onClick={() => setJoin(n)}><Ic.Download /></button>
                          <button className="btn danger xs" title="حذف" onClick={() => del(n)}><Ic.Trash /></button>
                        </div>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>}
      </Card>

      {/* افزودن */}
      {open && (
        <Modal title="سرور جدید" sub="یک گره ورودی یا خروجی به شبکه اضافه کنید" onClose={() => setOpen(false)}
          footer={<>
            <Btn icon={Ic.Plus} onClick={add} disabled={busy}>{busy ? 'در حال ساخت…' : 'ساخت سرور'}</Btn>
            <Btn kind="ghost" onClick={() => setOpen(false)}>انصراف</Btn>
          </>}>
          <Field label="نام سرور" hint="یک نام خوانا برای شناسایی، مثلاً «آلمان · فرانکفورت»">
            <input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="آلمان · فرانکفورت" autoFocus />
          </Field>
          <Field label="نشانی عمومی (اختیاری)" hint="اگر خالی بماند، پنل آن را از اتصال ایجنت تشخیص می‌دهد">
            <input className="ltr" value={f.host} onChange={e => setF({ ...f, host: e.target.value })} placeholder="1.2.3.4" />
          </Field>
        </Modal>
      )}

      {/* دستور اتصال */}
      {join && (
        <Modal wide title={'اتصال «' + join.name + '»'} sub="این دستور را روی سرور موردنظر اجرا کنید" onClose={() => setJoin(null)}
          footer={<>
            <Btn icon={Ic.Copy} onClick={() => { navigator.clipboard.writeText(install); toast.show('دستور کپی شد') }}>کپی دستور</Btn>
            <Btn kind="ghost" onClick={() => setJoin(null)}>بستن</Btn>
          </>}>
          <Field label="دستور نصب ایجنت">
            <Code>{install}</Code>
          </Field>
          <Field label="توکن اتصال">
            <Code>{join.token}</Code>
          </Field>
          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <Badge kind="info" dot>پورت اختصاصی: <b className="mono" style={{ marginRight: 4 }}>{join.private_port || 'اختصاص داده می‌شود'}</b></Badge>
          </div>
        </Modal>
      )}
    </div>
  )
}
