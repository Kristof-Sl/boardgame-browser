// Supabase client
// Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env and in Vercel environment variables

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase env vars not set. Event features will not work.')
}

// Minimal Supabase REST client — no SDK needed, keeps bundle small
class SupabaseClient {
  constructor(url, key) {
    this.url = url
    this.key = key
  }

  headers() {
    return {
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    }
  }

  // SELECT
  async select(table, { filter, order, single } = {}) {
    let url = `${this.url}/rest/v1/${table}?select=*`
    if (filter) url += `&${filter}`
    if (order) url += `&order=${order}`
    const res = await fetch(url, { headers: this.headers() })
    if (!res.ok) throw new Error(`Supabase select error: ${await res.text()}`)
    const data = await res.json()
    return single ? data[0] : data
  }

  // INSERT
  async insert(table, row) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`Supabase insert error: ${await res.text()}`)
    return await res.json()
  }

  // UPDATE
  async update(table, row, filter) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`Supabase update error: ${await res.text()}`)
    return await res.json()
  }

  // DELETE
  async delete(table, filter) {
    const res = await fetch(`${this.url}/rest/v1/${table}?${filter}`, {
      method: 'DELETE',
      headers: this.headers(),
    })
    if (!res.ok) throw new Error(`Supabase delete error: ${await res.text()}`)
  }

  // UPSERT (insert or update on conflict)
  async upsert(table, row, onConflict) {
    const url = `${this.url}/rest/v1/${table}${onConflict ? `?on_conflict=${onConflict}` : ''}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'Prefer': 'return=representation,resolution=merge-duplicates' },
      body: JSON.stringify(row),
    })
    if (!res.ok) throw new Error(`Supabase upsert error: ${await res.text()}`)
    return await res.json()
  }

  // Real-time subscription via Supabase Realtime websocket
  subscribe(table, filter, callback) {
    const wsUrl = this.url.replace('https://', 'wss://').replace('http://', 'ws://')
    const ws = new WebSocket(`${wsUrl}/realtime/v1/websocket?apikey=${this.key}&vsn=1.0.0`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        topic: `realtime:public:${table}${filter ? `:${filter}` : ''}`,
        event: 'phx_join',
        payload: {},
        ref: null,
      }))
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.event === 'INSERT' || msg.event === 'UPDATE' || msg.event === 'DELETE') {
        callback(msg.event, msg.payload.record)
      }
    }

    return () => ws.close()
  }
}

export const db = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY)
