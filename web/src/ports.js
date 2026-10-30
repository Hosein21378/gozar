// منطق پورت‌ها — دقیقاً همان قواعدِ بک‌اند (ports.go) تا رابط و سرور هم‌رأی باشند
export const MAX_PORTS = 256

// پارس رشته به فهرستی از {listen, target}
export function parsePorts(spec) {
  const out = []
  if (!spec || !String(spec).trim()) return { list: [], error: '' }
  for (const raw of String(spec).split(',')) {
    const part = raw.trim()
    if (!part) continue
    if (part.includes('=')) {
      const [a, b] = part.split('=', 2)
      const l = num(a), t = num(b)
      if (l === null || t === null) return { list: [], error: `نگاشت نامعتبر: «${part}» — قالب درست: 2053=53` }
      const e = push(out, l, t)
      if (e) return { list: [], error: e }
      continue
    }
    if (part.includes('-')) {
      const [a, b] = part.split('-', 2)
      const lo = num(a), hi = num(b)
      if (lo === null || hi === null) return { list: [], error: `بازهٔ نامعتبر: «${part}» — قالب درست: 8000-8010` }
      if (lo > hi) return { list: [], error: `بازه برعکس است: «${part}»` }
      if (hi - lo > 200) return { list: [], error: `بازهٔ «${part}» خیلی بزرگ است (حداکثر ۲۰۰ پورت)` }
      for (let p = lo; p <= hi; p++) {
        const e = push(out, p, p)
        if (e) return { list: [], error: e }
      }
      continue
    }
    const p = num(part)
    if (p === null) return { list: [], error: `«${part}» یک پورت معتبر نیست (باید عددی بین ۱ تا ۶۵۵۳۵ باشد)` }
    const e = push(out, p, p)
    if (e) return { list: [], error: e }
  }
  if (out.length > MAX_PORTS) return { list: [], error: `تعداد پورت‌ها زیاد است (حداکثر ${MAX_PORTS} پورت در هر تونل)` }
  return { list: out, error: '' }
}

function num(s) {
  const v = String(s).trim()
  if (!/^\d+$/.test(v)) return null
  const n = parseInt(v, 10)
  if (n < 1 || n > 65535) return null
  return n
}
function push(out, listen, target) {
  if (out.some(p => p.listen === listen)) return `پورت ${listen} دو بار تکرار شده`
  out.push({ listen, target })
  if (out.length > MAX_PORTS) return `تعداد پورت‌ها زیاد است (حداکثر ${MAX_PORTS} پورت در هر تونل)`
  return ''
}

// فهرست -> رشته (فشرده: بازه‌های پشت‌سرهم را یکی می‌کند)
export function buildSpec(rows) {
  const single = rows.filter(r => r.listen === r.target).map(r => r.listen).sort((a, b) => a - b)
  const mapped = rows.filter(r => r.listen !== r.target)
  const parts = []
  // بازه‌سازی
  let i = 0
  while (i < single.length) {
    let j = i
    while (j + 1 < single.length && single[j + 1] === single[j] + 1) j++
    if (j - i >= 2) parts.push(`${single[i]}-${single[j]}`)
    else for (let k = i; k <= j; k++) parts.push(String(single[k]))
    i = j + 1
  }
  for (const m of mapped) parts.push(`${m.listen}=${m.target}`)
  return parts.join(',')
}

// پورت‌های تکراری بین این تونل و بقیهٔ تونل‌های همان سرور ورودی
export function findConflicts(list, allTunnels, nodeId, skipId) {
  if (!list.length) return []
  const want = new Set(list.map(p => p.listen))
  const hit = new Set()
  for (const t of allTunnels || []) {
    if (t.id === skipId) continue
    if (nodeId && t.source_node_id !== nodeId) continue
    for (const p of (t.port_list || [])) {
      if (want.has(p.listen)) hit.add(p.listen)
    }
  }
  return [...hit].sort((a, b) => a - b)
}
