// Workbox requires cross-origin regular expressions to match from the start of the URL.
export const privateCacheUrls = /^https?:\/\/[^/]+\/(?:(?:(?:ja|en)\/)?(?:dashboard|jobs\/[^/?#]+\/review|admin)|api\/(?:jobs|google-calendars|admin)|rest\/v1\/jobs)(?:[/?#]|$)/
