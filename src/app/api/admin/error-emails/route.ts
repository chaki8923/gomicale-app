import { getAdminSession } from '@/lib/admin-auth'
import { assertEmailConfigured, getAdminEmailService } from '@/lib/admin-error-email-server'
import { createAdminEmailHandlers } from '@/lib/admin-error-email-http'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export const { POST } = createAdminEmailHandlers({
  authorize: getAdminSession,
  list: async () => { throw new Error('Unsupported operation') },
  send: (adminId, input) => {
    assertEmailConfigured()
    return getAdminEmailService().send(adminId, input)
  },
})
