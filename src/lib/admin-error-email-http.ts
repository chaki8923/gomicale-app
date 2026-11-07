import { AdminEmailError, parseSendEmailInput, type SendEmailInput, type SendEmailResult, type ErrorJobsPage } from './admin-error-email-types'
import { parseErrorJobsPage } from './admin-error-email-service'

type Session = { status: number; user: { id: string } | null }
type Dependencies = {
  authorize: () => Promise<Session>
  list: (page: number) => Promise<ErrorJobsPage>
  send: (adminId: string, input: SendEmailInput) => Promise<SendEmailResult>
}

export function createAdminEmailHandlers(deps: Dependencies) {
  function json(value: unknown, status = 200) {
    return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' } })
  }
  function failure(error: unknown) {
    if (error instanceof AdminEmailError) return json({ error: error.code }, error.status)
    // Do not expose provider errors, email addresses, credentials, or DB details.
    console.error('[admin-error-emails] request failed')
    return json({ error: 'SERVER_ERROR' }, 500)
  }
  return {
    async GET(request: Request) {
      try {
        const session = await deps.authorize()
        if (session.status !== 200 || !session.user) return json({ error: session.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN' }, session.status === 401 ? 401 : 403)
        const page = parseErrorJobsPage(new URL(request.url).searchParams.get('page'))
        return json(await deps.list(page))
      } catch (error) { return failure(error) }
    },
    async POST(request: Request) {
      try {
        const session = await deps.authorize()
        if (session.status !== 200 || !session.user) return json({ error: session.status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN' }, session.status === 401 ? 401 : 403)
        const origin = request.headers.get('origin')
        if (origin && origin !== new URL(request.url).origin) return json({ error: 'FORBIDDEN' }, 403)
        if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
          return json({ error: 'INVALID_INPUT' }, 415)
        }
        // Bound the body before parsing; do not trust Content-Length alone.
        const reader = request.body?.getReader()
        if (!reader) throw new AdminEmailError('INVALID_INPUT')
        const chunks: Uint8Array[] = []
        let size = 0
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            size += value.byteLength
            if (size > 65536) { await reader.cancel(); throw new AdminEmailError('INVALID_INPUT', 413) }
            chunks.push(value)
          }
        } finally { reader.releaseLock() }
        const bytes = new Uint8Array(size)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
        let value: unknown
        try { value = JSON.parse(new TextDecoder().decode(bytes)) } catch { throw new AdminEmailError('INVALID_INPUT') }
        const input = parseSendEmailInput(value)
        return json(await deps.send(session.user.id, input))
      } catch (error) { return failure(error) }
    },
  }
}
