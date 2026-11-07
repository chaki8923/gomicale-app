import { getAdminSession } from '@/lib/admin-auth'
import { getAdminEmailService } from '@/lib/admin-error-email-server'
import { createAdminEmailHandlers } from '@/lib/admin-error-email-http'

export const dynamic = 'force-dynamic'

export const { GET } = createAdminEmailHandlers({
  authorize: getAdminSession,
  list: page => getAdminEmailService().list(page),
  send: async () => { throw new Error('Unsupported operation') },
})
