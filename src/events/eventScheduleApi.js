import { db } from './supabase'
import { compactSchedule } from './eventData'

export async function createEventSchedule(eventId, schedule, scheduleParams, label, isDefault = true) {
  const [created] = await db.rpc('create_event_schedule', {
    p_event_id: eventId,
    p_schedule: compactSchedule(schedule),
    p_schedule_params: scheduleParams || {},
    p_label: label,
    p_is_default: isDefault,
  })
  return created
}