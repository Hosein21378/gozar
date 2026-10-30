import React from 'react'
import { api } from '../api.js'
import { Card, Btn, Field, Badge, Code, Loader } from '../ui.jsx'
import { Ic } from '../icons.jsx'

export default function Settings({ toast, me }) {
  const [info, setInfo] = React.useState(null)
  const [sni, setSni] = React.useState('')
  const [busy, setBusy] = React.useState(false)

  const load = () => api('GET', '/api/settings').then(s => { setInfo(s); setSni(s.private_sni || '') }).catch(e => toast.show(e.message, 'err'))
  React.useEffect(() => { load() }, [])

  async function saveSni(e) {
    e.preventDefault(); setBusy(true)
    try { await api('POST', '/api/settings', { private_sni: sni }); toast.show('تنظیمات ذخیره شد'); load() }
    catch (err) { toast.show(err.message, 'err') }
    setBusy(false)
  }
  async function update() {
    setBusy(true)
    try { const r = await api('POST', '/api/update', {}); toast.show(r.message || 'به‌روزرسانی انجام شد') }
    catch (err) { toast.show(err.message, 'err') }
    setBusy(false)
  }

  if (!info) return <Loader />

  const rows = [
    ['نسخهٔ پنل', info.version || '1.0.0'],
    ['تعداد سرور', info.nodes ?? '—'],
    ['تعداد تونل', info.tunnels ?? '—'],
  ]

  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <Card>
        <div className="hd">
          <div><h3>دربارهٔ گذر</h3><div className="sub">اطلاعات نسخه و وضعیت</div></div>
          <span className="ic g" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,rgba(52,211,153,.22),rgba(52,211,153,.06))', color: 'var(--acc)', border: '1px solid rgba(52,211,153,.25)' }}><Ic.Info /></span>
        </div>
        <div style={{ display: 'grid', gap: 2 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="dim" style={{ fontSize: 13 }}>{k}</span>
              <b className="mono" style={{ fontSize: 13 }}>{String(v)}</b>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 16 }}>
          <Btn kind="ghost" icon={Ic.Download} onClick={update} disabled={busy}>بررسی و به‌روزرسانی</Btn>
        </div>
      </Card>

      <Card>
        <div className="hd">
          <div><h3>ترانسپورت اختصاصی</h3><div className="sub">عبور از شناسایی ترافیک</div></div>
          <Badge kind="vio"><Ic.Shield style={{ width: 11, height: 11 }} /> اختیاری</Badge>
        </div>
        <form onSubmit={saveSni}>
          <Field label="SNI نقاب"
            hint="دامنه‌ای که در نقاب ترافیک به کار می‌رود. اگر دامنه‌ای به سرور ورودی اشاره می‌کند، اینجا بنویسید.">
            <input className="ltr" value={sni} onChange={e => setSni(e.target.value)} placeholder="www.cloudflare.com" />
          </Field>
          <Btn icon={Ic.Save} disabled={busy}>{busy ? 'در حال ذخیره…' : 'ذخیره تنظیمات'}</Btn>
        </form>
        <p className="dim" style={{ fontSize: 12, marginTop: 14, lineHeight: 1.7 }}>
          این ترانسپورت هیچ‌وقت به‌طور خودکار انتخاب نمی‌شود — فقط زمانی که خودتان آن را برای یک تونل برگزینید.
          پورت هر سرور به‌صورت تصادفی ساخته می‌شود و در جدول سرورها دیده می‌شود.
        </p>
      </Card>

      <Card className="flat">
        <div className="hd"><h3>نصب ایجنت</h3><div className="sub">دستور کلی اتصال یک سرور جدید</div></div>
        <Code>bash &lt;(curl -fsSL https://raw.githubusercontent.com/Hosein21378/gozar/main/scripts/install.sh) --agent &lt;TOKEN&gt;</Code>
        <p className="dim" style={{ fontSize: 12, marginTop: 12 }}>
          توکن هر سرور را از ستون عملیاتِ جدول «سرورها» بگیرید.
        </p>
      </Card>

      <Card className="flat">
        <div className="hd"><h3>امنیت</h3><div className="sub">توصیه‌ها</div></div>
        <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
          {[
            'رمز پیش‌فرض مدیر (admin123) را حتماً تغییر دهید.',
            'پنل را پشت HTTPS و در صورت امکان فقط روی IP مجاز باز کنید.',
            'از هر سرور فقط یک ایجنت با همان توکن اجرا کنید.',
          ].map((t, i) => (
            <div key={i} className="row" style={{ gap: 9, alignItems: 'flex-start', color: 'var(--dim)' }}>
              <span style={{ color: 'var(--warn)', flex: '0 0 auto', marginTop: 2 }}><Ic.Alert style={{ width: 14, height: 14 }} /></span>
              <span style={{ flex: 1 }}>{t}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
