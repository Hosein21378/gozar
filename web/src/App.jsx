import React from 'react'
import { api, getToken, setToken } from './api.js'
import { Btn, Field, Spinner, useToast } from './ui.jsx'
import { Ic } from './icons.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Tunnels from './pages/Tunnels.jsx'
import Nodes from './pages/Nodes.jsx'
import Users from './pages/Users.jsx'
import Settings from './pages/Settings.jsx'

const TABS = [
  { id: 'dashboard', label: 'داشبورد', icon: Ic.Dashboard, sub: 'نمای کلی سیستم و ترافیک' },
  { id: 'tunnels', label: 'تونل‌ها', icon: Ic.Tunnel, sub: 'مدیریت مسیرهای عبور' },
  { id: 'nodes', label: 'سرورها', icon: Ic.Server, sub: 'سرورهای ورودی و خروجی' },
  { id: 'users', label: 'کاربران', icon: Ic.Users, sub: 'دسترسی‌ها و نقش‌ها' },
  { id: 'settings', label: 'تنظیمات', icon: Ic.Settings, sub: 'پیکربندی و به‌روزرسانی' },
]

export default function App() {
  const [ready, setReady] = React.useState(false)
  const [me, setMe] = React.useState(null)
  const [tab, setTab] = React.useState('dashboard')
  const [menu, setMenu] = React.useState(false)
  const [tick, setTick] = React.useState(0)
  const [busy, setBusy] = React.useState(false)
  const toast = useToast()

  React.useEffect(() => {
    const h = () => { setMe(null); setReady(true) }
    window.addEventListener('gozar:logout', h)
    return () => window.removeEventListener('gozar:logout', h)
  }, [])

  React.useEffect(() => {
    if (!getToken()) { setReady(true); return }
    api('GET', '/api/me').then(u => { setMe(u); setReady(true) }).catch(() => setReady(true))
  }, [])

  React.useEffect(() => {
    if (!me) return
    const t = setInterval(() => setTick(x => x + 1), 5000)
    return () => clearInterval(t)
  }, [me])

  if (!ready) return <div className="center"><Spinner /></div>
  if (!me) return <Login onLogin={u => setMe(u)} toast={toast} />

  const cur = TABS.find(t => t.id === tab)
  const refresh = async () => {
    setBusy(true); setTick(x => x + 1)
    setTimeout(() => setBusy(false), 500)
  }

  const page = {
    dashboard: <Dashboard toast={toast} me={me} tick={tick} />,
    tunnels: <Tunnels toast={toast} me={me} tick={tick} onNew={() => setTab('tunnels')} />,
    nodes: <Nodes toast={toast} me={me} tick={tick} />,
    users: <Users toast={toast} me={me} tick={tick} />,
    settings: <Settings toast={toast} me={me} />,
  }[tab]

  return (
    <div className="app">
      <div className="aurora"><i /><i /><i /><span className="grid" /></div>

      {menu && <div className="backdrop" onClick={() => setMenu(false)} />}

      <aside className={'sidebar' + (menu ? ' open' : '')}>
        <div className="brand">
          <span className="mark"><Ic.Logo /></span>
          <span className="txt"><b>گذر</b><small>TUNNEL PANEL</small></span>
        </div>
        <div className="side-label">منو</div>
        <nav>
          {TABS.map(t => (
            <button key={t.id} className={'nav-item' + (tab === t.id ? ' active' : '')}
              onClick={() => { setTab(t.id); setMenu(false) }}>
              <t.icon />
              {t.label}
              {t.id === 'nodes' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <div className="user-chip">
            <span className="av">{me.username.slice(0, 2).toUpperCase()}</span>
            <span className="who"><b>{me.username}</b><small>{me.role === 'admin' ? 'مدیر کل' : 'کاربر'}</small></span>
            <span className="spacer" />
            <button className="icon-btn" title="خروج" onClick={() => { setToken(''); setMe(null) }}><Ic.Logout /></button>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="burger" onClick={() => setMenu(!menu)}><Ic.Menu /></button>
          <div className="ttl">
            <h1>{cur.label}</h1>
            <p>{cur.sub}</p>
          </div>
          <span className="spacer" />
          <span className="live"><span className="pulse" />زنده</span>
          <button className="btn ghost sm" onClick={refresh} disabled={busy}>
            <Ic.Refresh /> به‌روزرسانی
          </button>
        </header>
        <div className="content">{page}</div>
      </main>
      {toast.el}
    </div>
  )
}

function Login({ onLogin, toast }) {
  const [u, setU] = React.useState('admin')
  const [p, setP] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  async function go(e) {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api('POST', '/api/auth/login', { username: u, password: p })
      setToken(r.token)
      const me = await api('GET', '/api/me')
      onLogin(me)
    } catch (err) { toast.show(err.message, 'err') }
    setBusy(false)
  }
  return (
    <div className="login-wrap">
      <div className="aurora"><i /><i /><i /><span className="grid" /></div>
      <form className="login-card" onSubmit={go}>
        <div className="brand">
          <span className="mark"><Ic.Logo /></span>
          <span className="txt"><b>گذر</b><small>پنل مدیریت تونل</small></span>
        </div>
        <Field label="نام کاربری">
          <input value={u} onChange={e => setU(e.target.value)} autoComplete="username" placeholder="admin" />
        </Field>
        <Field label="رمز عبور">
          <input type="password" value={p} onChange={e => setP(e.target.value)} autoComplete="current-password" placeholder="••••••••" />
        </Field>
        <Btn block disabled={busy} icon={Ic.Lock}>{busy ? 'در حال ورود…' : 'ورود به پنل'}</Btn>
        <div className="login-hint">گذر · نسخه ۱.۰.۰</div>
      </form>
      {toast.el}
    </div>
  )
}
