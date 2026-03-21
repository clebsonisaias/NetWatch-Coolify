const BASE = import.meta.env.VITE_API_URL || ''
let _token = localStorage.getItem('citmax_token')

export const setToken = t => { _token = t; t ? localStorage.setItem('citmax_token',t) : localStorage.removeItem('citmax_token') }
export const getToken = () => _token

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  const res = await fetch(`${BASE}/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || `Erro ${res.status}`)
  return data
}

export const api = {
  // Auth
  login: (email, password) => {
    const form = new URLSearchParams({ username: email, password })
    return fetch(`${BASE}/api/auth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form,
    }).then(r => { if (!r.ok) throw new Error('Credenciais inválidas'); return r.json() })
  },

  // Registro público
  register: (body) => fetch(`${BASE}/api/public/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.detail); return d }),

  // Planos
  getPlans: () => req('GET', '/public/plans'),

  // Tenant
  getMyTenant:     ()     => req('GET',  '/tenant/me'),
  updateTenant:    (body) => req('PUT',  '/tenant/me', body),
  getUsage:        ()     => req('GET',  '/tenant/usage'),
  getBillingPortal:()     => req('GET',  '/tenant/billing-portal'),
  getPayments:     ()     => req('GET',  '/tenant/payments'),
  startCheckout:   (plan) => req('POST', `/public/checkout/${plan}`),

  // Devices
  getDevices:   ()      => req('GET',    '/devices'),
  createDevice: (body)  => req('POST',   '/devices', body),
  updateDevice: (id, b) => req('PUT',    `/devices/${id}`, b),
  deleteDevice: (id)    => req('DELETE', `/devices/${id}`),
  collectNow:   (id)    => req('POST',   `/devices/${id}/collect`),

  // Links
  getLinks:   ()      => req('GET',    '/links'),
  createLink: (body)  => req('POST',   '/links', body),
  updateLink: (id, b) => req('PUT',    `/links/${id}`, b),
  deleteLink: (id)    => req('DELETE', `/links/${id}`),

  // Alerts
  getAlerts:    (resolved=false) => req('GET',   `/alerts?resolved=${resolved}`),
  resolveAlert: (id)             => req('PATCH', `/alerts/${id}/resolve`),

  // Users
  getUsers:   ()      => req('GET',    '/users'),
  createUser: (body)  => req('POST',   '/users', body),
  updateUser: (id, b) => req('PUT',    `/users/${id}`, b),
  deleteUser: (id)    => req('DELETE', `/users/${id}`),

  // Ping
  ping: (ip) => req('GET', `/ping/${ip}`),
}

// ─── WebSocket (com tenant_id no token) ───────────────────────────────────────
export function createWS(onMessage) {
  const base = (import.meta.env.VITE_WS_URL ||
    (window.location.protocol === 'https:' ? 'wss://' : 'ws://') +
    window.location.host + '/ws')
  const url = `${base}?token=${encodeURIComponent(_token || '')}`

  let ws, pingTimer, retryTimer

  function connect() {
    ws = new WebSocket(url)
    ws.onopen = () => {
      pingTimer = setInterval(() => {
        if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping' }))
      }, 25000)
    }
    ws.onmessage = e => { try { onMessage(JSON.parse(e.data)) } catch {} }
    ws.onclose   = () => { clearInterval(pingTimer); retryTimer = setTimeout(connect, 3000) }
    ws.onerror   = () => ws.close()
  }

  connect()
  return () => { clearTimeout(retryTimer); clearInterval(pingTimer); ws?.close() }
}
