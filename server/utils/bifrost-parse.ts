import * as cheerio from 'cheerio'
import type { Activity } from '#shared/types/activity'

export function parseEnrolledActivities(html: string): Activity[] {
  if (html.includes('/memberportal/login') && !html.includes('enrolled-activities-table')) {
    throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
  }

  const $ = cheerio.load(html)
  const table = $('#enrolled-activities-table')

  if (!table.length) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Activities table not found on Foreninglet page.',
    })
  }

  return table.find('tbody tr').map((_, row) => {
    const cells = $(row).find('td')
    return {
      teamId: $(cells[0]).text().trim(),
      name: $(cells[1]).text().trim(),
      date: $(cells[2]).text().trim(),
    }
  }).get()
}
