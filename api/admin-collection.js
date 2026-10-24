import { timingSafeEqual } from 'node:crypto'

function passwordMatches(candidate, configured) {
  if (typeof candidate !== 'string' || !configured) return false
  const provided = Buffer.from(candidate)
  const expected = Buffer.from(configured)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  const { action, username, games, eventId, scheduleId, password } = req.body || {}
  if (!passwordMatches(password, process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ error: 'Admin authorization failed.' })
  }
  if (action === 'authorize') return res.status(200).json({ ok: true })

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server-side Supabase credentials are not configured.' })
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal,resolution=merge-duplicates',
  }

  try {
    if (action === 'upsert') {
      const accountName = String(username || '').trim()
      if (!accountName || !Array.isArray(games)) return res.status(400).json({ error: 'A username and games array are required.' })
      const response = await fetch(`${supabaseUrl}/rest/v1/game_collection?on_conflict=username`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ username: accountName, games, updated_at: new Date().toISOString() }),
      })
      if (!response.ok) return res.status(response.status).json({ error: await response.text() })
      return res.status(200).json({ ok: true })
    }

    if (action === 'remove') {
      const accountName = String(username || '').trim()
      if (!accountName) return res.status(400).json({ error: 'A username is required.' })
      const response = await fetch(`${supabaseUrl}/rest/v1/game_collection?username=eq.${encodeURIComponent(accountName)}`, {
        method: 'DELETE',
        headers,
      })
      if (!response.ok) return res.status(response.status).json({ error: await response.text() })
      return res.status(200).json({ ok: true })
    }

    if (action === 'set-schedule-default' || action === 'delete-schedule') {
      if (!eventId || !scheduleId) return res.status(400).json({ error: 'An event ID and schedule ID are required.' })
      const functionName = action === 'set-schedule-default'
        ? 'admin_set_event_schedule_default'
        : 'admin_delete_event_schedule'
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_event_id: eventId, p_schedule_id: scheduleId }),
      })
      if (!response.ok) return res.status(response.status).json({ error: await response.text() })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Unsupported admin collection action.' })
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Database request failed.' })
  }
}