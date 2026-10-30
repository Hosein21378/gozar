let token = localStorage.getItem('gozar_token') || ''
export function setToken(t) { token = t || ''; if (t) localStorage.setItem('gozar_token', t); else localStorage.removeItem('gozar_token') }
export function getToken() { return token }

/* حالت نمایش طراحی: داده‌های نمونه، بدون نیاز به سرور */
const DEMO = import.meta.env.VITE_DEMO === '1'

export async function api(method, path, body) {
  if (DEMO) return mock(method, path, body)
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch (e) { data = {} }
  if (r.status === 401) { setToken(''); window.dispatchEvent(new Event('gozar:logout')) }
  if (!r.ok) throw new Error(data.detail || ('خطا ' + r.status))
  return data
}

/* ---------------- داده‌های نمونه ---------------- */
const now = () => new Date(Date.now() - 8000).toISOString().slice(0, 19).replace('T', ' ')
const ago = s => new Date(Date.now() - s * 1000).toISOString().slice(0, 19).replace('T', ' ')

let db = {
  me: { id: 1, username: 'admin', role: 'admin' },
  nodes: [
    { id: 1, name: 'آلمان · فرانکفورت', host: '5.9.10.11', online: true, last_seen: now(), os_info: 'Ubuntu 22.04', cpu_percent: 23, mem_used_bytes: 2.1e9, mem_total_bytes: 4e9, relay_port: 3080, private_port: 41873, agent_version: '1.0.0', reported_ip: '5.9.10.11', observed_ip: '5.9.10.11', token: 'goz1_a8Fk92mQxLpR4vTn7wYzBcDeFgHjKmNpQrStUvWxYz' },
    { id: 2, name: 'فرانسه · پاریس', host: '51.20.30.40', online: true, last_seen: now(), os_info: 'Debian 12', cpu_percent: 61, mem_used_bytes: 5.4e9, mem_total_bytes: 8e9, relay_port: 3080, private_port: 39204, agent_version: '1.0.0', reported_ip: '51.20.30.40', observed_ip: '51.20.30.40', token: 'goz1_Zx9wVuTsRqPoNmLkJiHgFeDcBaZyXwVuTsRqPoNmLk' },
    { id: 3, name: 'هلند · آمستردام', host: '45.88.99.77', online: false, last_seen: ago(4200), os_info: 'Ubuntu 20.04', cpu_percent: 0, mem_used_bytes: 0, mem_total_bytes: 4e9, relay_port: 3080, private_port: 52910, agent_version: '1.0.0', reported_ip: '45.88.99.77', observed_ip: '45.88.99.77', token: 'goz1_QwErTyUiOpAsDfGhJkLzXcVbNmQwErTyUiOpAsDfGhJ' },
  ],
  tunnels: [
    { id: 1, name: 'تونل اصلی · HTTPS', type: 'reverse', transport: 'private', protocol: 'tcp', profile: 'balanced', source_node_id: 1, dest_node_id: 2, ports: '443,80,8443,2053=53', listen_addr: '5.9.10.11:443، 80، 8443، 2053→53', target_host: '127.0.0.1', active: true, connected: true, bytes: 184.7e9, last_error: '', created_at: ago(86400 * 12), port_count: 4, port_list: [{ listen: 443, target: 443 }, { listen: 80, target: 80 }, { listen: 8443, target: 8443 }, { listen: 2053, target: 53 }] },
    { id: 2, name: 'پشتیبان · WebSocket', type: 'reverse', transport: 'wss', protocol: 'tcp', profile: 'gaming', source_node_id: 2, dest_node_id: 1, ports: '8000-8005', listen_addr: ':8000-8005', target_host: '127.0.0.1', active: true, connected: true, bytes: 42.3e9, last_error: '', created_at: ago(86400 * 6), port_count: 6, port_list: [8000, 8001, 8002, 8003, 8004, 8005].map(p => ({ listen: p, target: p })) },
    { id: 3, name: 'دوربرگردان', type: 'forward', transport: 'quic', protocol: 'udp', profile: 'ultraspeed', source_node_id: 1, dest_node_id: 2, ports: '1194', listen_addr: ':1194', target_host: '10.0.0.5', active: true, connected: false, bytes: 1.2e9, last_error: 'timeout: no recent network activity', created_at: ago(3600 * 30), port_count: 1, port_list: [{ listen: 1194, target: 1194 }] },
  ],
  users: [
    { id: 1, username: 'admin', role: 'admin', created_at: ago(86400 * 40) },
    { id: 2, username: 'hosein', role: 'admin', created_at: ago(86400 * 20) },
    { id: 3, username: 'operator', role: 'user', created_at: ago(86400 * 3) },
  ],
  settings: { private_sni: 'www.cloudflare.com', version: '1.0.0' },
}

function parseDemoPorts(spec) {
  const out = []
  if (!spec || !String(spec).trim()) return { list: [] }
  for (const raw of String(spec).split(',')) {
    const part = raw.trim(); if (!part) continue
    const N = v => (/^\d+$/.test(v) && +v >= 1 && +v <= 65535) ? +v : null
    if (part.includes('=')) {
      const [a, b] = part.split('=', 2); const l = N(a), t = N(b)
      if (l === null || t === null) return { list: out, error: 'bad' }
      out.push({ listen: l, target: t }); continue
    }
    if (part.includes('-')) {
      const [a, b] = part.split('-', 2); const lo = N(a), hi = N(b)
      if (lo === null || hi === null || lo > hi) return { list: out, error: 'bad' }
      for (let p = lo; p <= hi; p++) out.push({ listen: p, target: p }); continue
    }
    const p = N(part); if (p === null) return { list: out, error: 'bad' }
    out.push({ listen: p, target: p })
  }
  return { list: out }
}

function mock(method, path, body) {
  return new Promise((res, rej) => setTimeout(() => {
    const j = o => res(JSON.parse(JSON.stringify(o)))
    if (path === '/api/auth/login') return j({ token: 'demo' })
    if (path === '/api/me') return j(db.me)
    if (path === '/api/stats') return j({
      nodes_total: db.nodes.length,
      nodes_online: db.nodes.filter(n => n.online).length,
      tunnels_total: db.tunnels.length,
      tunnels_connected: db.tunnels.filter(t => t.connected).length,
      traffic_in: 228.2e9, traffic_out: 91.4e9, users_total: db.users.length,
      series: [12, 18, 14, 26, 22, 34, 29, 41, 38, 52, 47, 61],
      tunnels: db.tunnels.map(t => ({ id: t.id, name: t.name, entry: t.entry_name, exit: t.exit_name, connected: t.connected, bytes: t.bytes })),
    })
    if (path === '/api/nodes') {
      if (method === 'POST') { const n = { id: db.nodes.length + 1, name: body.name, host: '', online: false, last_seen: '', os_info: '', cpu_percent: 0, mem_used_bytes: 0, mem_total_bytes: 0, relay_port: 3080, private_port: 20000 + Math.floor(Math.random() * 40000), agent_version: '', token: 'goz1_' + Math.random().toString(36).slice(2, 42) }; db.nodes.push(n); return j(n) }
      return j(db.nodes)
    }
    if (path === '/api/tunnels') {
      if (method === 'POST') return j({ ok: true, id: db.tunnels.length + 1 })
      return j(db.tunnels)
    }
    if (path === '/api/users') {
      if (method === 'POST') return j({ ok: true, id: db.users.length + 1 })
      return j(db.users)
    }
    if (path === '/api/settings') return j(db.settings)
    if (path.startsWith('/api/linktest')) return j({ probe_id: 1, done: true, ok: true, suggested: 'private', results: [{ transport: 'private', ok: true, ms: 38 }, { transport: 'wss', ok: true, ms: 71 }, { transport: 'quic', ok: false, ms: 0 }, { transport: 'kcp', ok: true, ms: 120 }] })
    if (method === 'PUT') {
      const id = +path.split('/').pop()
      const t = db.tunnels.find(x => x.id === id)
      if (t && body) {
        const pr = parseDemoPorts(body.ports)
        if (body.name) t.name = body.name
        if (body.ports !== undefined) {
          t.ports = body.ports
          t.port_list = pr.list.map(p => ({ listen: p.listen, target: p.target }))
          t.port_count = pr.list.length
          t.listen_addr = pr.list.length ? pr.list.map(p => p.listen === p.target ? p.listen : p.listen + '→' + p.target).join('، ') : 'خودکار'
        }
        if (body.target_host) t.target_host = body.target_host
        if (body.transport) t.transport = body.transport
        if (body.profile) t.profile = body.profile
      }
      return j({ ok: true })
    }
    if (method === 'DELETE') {
      const id = +path.split('/').pop()
      db.tunnels = db.tunnels.filter(x => x.id !== id)
      return j({ ok: true })
    }
    return j({ ok: true })
  }, 260))
}
