import { NextResponse } from 'next/server'
import { requireImportUser, googleToken, importErrorResponse } from '@/lib/calendar-import-server'
import { getOwnedCalendars, getEventColors } from '../../../../shared/google-calendars'
export async function GET() {
  try {
    const { user, db } = await requireImportUser()
    const { accessToken, selectedCalendarId } = await googleToken(user.id, db)
    const [calendars, colors] = await Promise.all([getOwnedCalendars(accessToken), getEventColors(accessToken)])
    return NextResponse.json({ calendars, colors, selectedCalendarId }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return importErrorResponse(error) }
}
