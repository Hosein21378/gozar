import React from 'react'
import { api } from '../api.js'
import { Card, Badge, Empty, Bar, Area, Ring, fmtBytes, fmtNum, relTime, Loader } from '../ui.jsx'
import { Ic } from '../icons.jsx'

export default function Dashboard({ toast, me, tick }) {
  const [s, setS] = React.useState(null)
  const [nodes, setNodes] = React.useState([])
  const [err, setErr] = React.useState('')

  React.useEffect(() => {
    let on = true
    Promise.all([api('GET', '/api/stats'), api('GET', '/api/nodes')])
      .then(([a, b]) => { if (on) { setS(a); setNodes(b); setErr('') } })
      .catch(e => on && setErr(e.message))
    return () => { on = false }
  }, [tick])

  if (!s) return err ? <Card className="flat"><Empty icon={Ic.Alert} title="خطا در دریافت آمار" desc={err} /></Card> : <Loader />

  const online = s.nodes_online || 0
  const total = s.nodes_total || 0
  const conn = s.tunnels_connected || 0
  const tt = s.tunnels_total || 0
  const health = total ? Math.round((online / total) * 100) : 0

  const Stat = ({ icon, tone, value, label, foot, trend }) => (
    <Card className="stat">
      <div className="top">
        <div>
          <div className="val">{value}</div>
          <div className="lbl">{label}</div>
        </div>
        <span className={'ic ' + tone}>{React.createElement(icon)}</span>
      </div>
      <div className="foot">{foot}
        {trend != null && <span className={'trend ' + (trend >= 0 ? 'up' : 'dn')}>
          {React.createElement(trend >= 0 ? Ic.Up : Ic.Down, { style: { width: 11, height: 11 } })}
          {Math.abs(trend)}%</span>}
      </div>
    </Card>
  )

  return (
    <div className="grid" style={{ gap: 16 }}>
      {/* کارت‌های آمار */}
      <div className="grid g4">
        <Stat icon={Ic.Server} tone="g" value={online + ' / ' + total} label="سرورهای آنلاین"
          foot={<span>سلامت شبکه {health}%</span>} trend={health >= 100 ? 0 : null} />
        <Stat icon={Ic.Link} tone="b" value={conn + ' / ' + tt} label="تونل‌های متصل"
          foot={<span>{tt ? Math.round((conn / tt) * 100) : 0}٪ پایدار</span>} trend={12} />
        <Stat icon={Ic.Down} tone="v" value={fmtBytes(s.traffic_out)} label="ترافیک خروجی"
          foot={<span>از کل {fmtBytes((s.traffic_in || 0) + (s.traffic_out || 0))}</span>} trend={8} />
        <Stat icon={Ic.Users} tone="y" value={fmtNum(s.users_total)} label="کاربران پنل"
          foot={<span>نقش شما: {me.role === 'admin' ? 'مدیر کل' : 'کاربر'}</span>} />
      </div>

      {/* نمودار + سلامت */}
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <div className="hd">
            <div><h3>ترافیک لحظه‌ای</h3><div className="sub">۱۲ ساعت گذشته</div></div>
            <Badge kind="ok" dot>زنده</Badge>
          </div>
          <Area data={s.series} h={168} />
          <div className="row" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            {['۱۲س پیش', '۹س پیش', '۶س پیش', '۳س پیش', 'اکنون'].map(t =>
              <span key={t} style={{ fontSize: 11, color: 'var(--dim2)' }}>{t}</span>)}
          </div>
        </Card>

        <Card>
          <div className="hd"><h3>سلامت سیستم</h3></div>
          <div className="row" style={{ gap: 18, justifyContent: 'center', padding: '8px 0 4px' }}>
            <Ring value={health} label={health + '%'} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 10 }}>
              {[
                ['سرورها', online + '/' + total, health],
                ['تونل‌ها', conn + '/' + tt, tt ? Math.round((conn / tt) * 100) : 0],
              ].map(([k, v, p]) => (
                <div key={k}>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                    <span className="dim">{k}</span><b className="mono">{v}</b>
                  </div>
                  <Bar value={p} tone={p > 80 ? 'g' : p > 50 ? 'y' : 'r'} />
                </div>
              ))}
            </div>
          </div>
          <div className="row" style={{ marginTop: 16, gap: 8 }}>
            <Badge kind="ok" dot>{online} آنلاین</Badge>
            <Badge kind="err" dot>{total - online} آفلاین</Badge>
          </div>
        </Card>
      </div>

      {/* تونل‌ها */}
      <Card>
        <div className="hd">
          <div><h3>تونل‌های فعال</h3><div className="sub">وضعیت لحظه‌ای هر مسیر</div></div>
          <Badge kind="info">{fmtNum(tt)} تونل</Badge>
        </div>
        {(s.tunnels || []).length === 0
          ? <Empty icon={Ic.Tunnel} title="هنوز تونلی نساخته‌اید" desc="اولین مسیر عبور را از بخش تونل‌ها بسازید." />
          : <div className="tbl-wrap">
            <table>
              <thead><tr><th>نام</th><th>مسیر</th><th>وضعیت</th><th>ترافیک</th></tr></thead>
              <tbody>
                {(s.tunnels || []).map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="row-name">
                        <span className="av" style={{ color: t.connected ? 'var(--acc)' : 'var(--dim)' }}><Ic.Tunnel style={{ width: 15, height: 15 }} /></span>
                        <span><b>{t.name}</b><small className="mono">{t.id}</small></span>
                      </div>
                    </td>
                    <td className="dim" style={{ fontSize: 12.5 }}>{t.entry} <Ic.Arrow style={{ width: 12, height: 12, verticalAlign: -2, opacity: .5 }} /> {t.exit}</td>
                    <td>{t.connected
                      ? <Badge kind="ok" dot>متصل</Badge>
                      : <Badge kind="err" dot>قطع</Badge>}</td>
                    <td className="mono" style={{ fontSize: 12.5 }}>{fmtBytes(t.bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Card>

      {/* سرورها */}
      <div className="grid g3">
        {nodes.map(n => {
          const mem = n.mem_total_bytes ? (n.mem_used_bytes / n.mem_total_bytes) * 100 : 0
          return (
            <Card key={n.id}>
              <div className="hd">
                <div className="row-name">
                  <span className="av" style={{ color: n.online ? 'var(--acc)' : 'var(--dim)' }}><Ic.Server style={{ width: 15, height: 15 }} /></span>
                  <span><b>{n.name}</b><small className="mono">{n.reported_ip || n.host || '—'}</small></span>
                </div>
                {n.online ? <Badge kind="ok" dot>آنلاین</Badge> : <Badge kind="err" dot>آفلاین</Badge>}
              </div>
              <div style={{ display: 'grid', gap: 9, marginTop: 4 }}>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span className="dim">پردازنده</span><b className="mono">{Math.round(n.cpu_percent || 0)}%</b>
                  </div>
                  <Bar value={n.cpu_percent} tone={(n.cpu_percent || 0) > 80 ? 'r' : (n.cpu_percent || 0) > 55 ? 'y' : 'g'} />
                </div>
                <div>
                  <div className="row" style={{ justifyContent: 'space-between', fontSize: 11.5, marginBottom: 4 }}>
                    <span className="dim">حافظه</span><b className="mono">{fmtBytes(n.mem_used_bytes)}</b>
                  </div>
                  <Bar value={mem} tone={mem > 85 ? 'r' : mem > 65 ? 'y' : 'g'} />
                </div>
              </div>
              <div className="foot" style={{ marginTop: 13, paddingTop: 11, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--dim2)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <Ic.Clock style={{ width: 12, height: 12 }} />{relTime(n.last_seen)}
                <span className="spacer" />
                <span className="mono" style={{ fontSize: 11 }}>{n.agent_version ? 'v' + n.agent_version : '—'}</span>
              </div>
            </Card>
          )
        })}
        {nodes.length === 0 && <Card className="flat"><Empty icon={Ic.Server} title="سروری ثبت نشده" desc="از بخش سرورها اولین سرور را اضافه کنید." /></Card>}
      </div>
    </div>
  )
}
