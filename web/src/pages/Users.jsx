import React from 'react'
import { api } from '../api.js'
import { Card, Btn, Field, Badge, Empty, Modal, Pick, relTime, Loader } from '../ui.jsx'
import { Ic } from '../icons.jsx'

export default function Users({ toast, me, tick }) {
  const [users, setUsers] = React.useState(null)
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [f, setF] = React.useState({ username: '', password: '', role: 'user' })

  const load = () => api('GET', '/api/users').then(setUsers).catch(e => toast.show(e.message, 'err'))
  React.useEffect(() => { load() }, [tick])

  async function add() {
    setBusy(true)
    try {
      await api('POST', '/api/users', f)
      setOpen(false); setF({ username: '', password: '', role: 'user' }); load()
      toast.show('کاربر «' + f.username + '» ساخته شد')
    } catch (err) { toast.show(err.message, 'err') }
    setBusy(false)
  }
  async function del(u) {
    if (!confirm('حذف کاربر «' + u.username + '»؟')) return
    try { await api('DELETE', '/api/users/' + u.id); load(); toast.show('حذف شد') }
    catch (e) { toast.show(e.message, 'err') }
  }

  if (!users) return <Loader />
  const admins = users.filter(u => u.role === 'admin').length

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="grid g3">
        <Card className="stat">
          <div className="top">
            <div><div className="val">{users.length}</div><div className="lbl">کل کاربران</div></div>
            <span className="ic b"><Ic.Users /></span>
          </div>
          <div className="foot">دارای دسترسی به پنل</div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div><div className="val">{admins}</div><div className="lbl">مدیران</div></div>
            <span className="ic v"><Ic.Shield /></span>
          </div>
          <div className="foot">دسترسی کامل به همه بخش‌ها</div>
        </Card>
        <Card className="stat">
          <div className="top">
            <div><div className="val">{users.length - admins}</div><div className="lbl">کاربران عادی</div></div>
            <span className="ic y"><Ic.Lock /></span>
          </div>
          <div className="foot">دسترسی محدود</div>
        </Card>
      </div>

      <Card>
        <div className="hd">
          <div><h3>مدیریت کاربران</h3><div className="sub">نقش‌ها و دسترسی‌ها</div></div>
          {me.role === 'admin' && <Btn icon={Ic.Plus} onClick={() => setOpen(true)}>کاربر جدید</Btn>}
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>کاربر</th><th>نقش</th><th>ساخته شده</th><th></th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td>
                    <div className="row-name">
                      <span className="av" style={{
                        background: u.role === 'admin' ? 'linear-gradient(135deg,#a78bfa,#38bdf8)' : 'rgba(255,255,255,.07)',
                        color: u.role === 'admin' ? '#0b1020' : 'var(--dim)'
                      }}>{u.username.slice(0, 2).toUpperCase()}</span>
                      <span><b>{u.username}</b><small>{u.id === me.id ? 'شما' : 'کاربر پنل'}</small></span>
                    </div>
                  </td>
                  <td>{u.role === 'admin' ? <Badge kind="vio">مدیر</Badge> : <Badge kind="mute">کاربر</Badge>}</td>
                  <td className="dim" style={{ fontSize: 12.5 }}>{u.created_at ? relTime(u.created_at) : '—'}</td>
                  <td>{u.id !== me.id && me.role === 'admin' &&
                    <button className="btn danger xs" onClick={() => del(u)}><Ic.Trash /></button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {open && (
        <Modal title="کاربر جدید" sub="دسترسی به پنل مدیریت" onClose={() => setOpen(false)}
          footer={<>
            <Btn icon={Ic.Plus} onClick={add} disabled={busy}>{busy ? 'در حال ساخت…' : 'ساخت کاربر'}</Btn>
            <Btn kind="ghost" onClick={() => setOpen(false)}>انصراف</Btn>
          </>}>
          <Field label="نام کاربری">
            <input className="ltr" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} placeholder="operator" autoFocus />
          </Field>
          <Field label="رمز عبور" hint="حداقل ۸ کاراکتر">
            <input className="ltr" type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} placeholder="••••••••" />
          </Field>
          <Field label="نقش">
            <Pick value={f.role} onChange={v => setF({ ...f, role: v })} options={[
              { id: 'user', label: 'کاربر', desc: 'مشاهده و مدیریت تونل‌ها', icon: Ic.Lock },
              { id: 'admin', label: 'مدیر', desc: 'دسترسی کامل به همه بخش‌ها', icon: Ic.Shield },
            ]} />
          </Field>
        </Modal>
      )}
    </div>
  )
}
