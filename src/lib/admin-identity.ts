type VerifiedUser = { email?: string | null; email_confirmed_at?: string | null }

// Only call with a user returned by auth.getUser(), never with client-supplied metadata.
export function isAdminUser(user: VerifiedUser | null, configuredEmail: string | undefined): boolean {
  const adminEmail = configuredEmail?.trim().toLowerCase()
  return Boolean(adminEmail && user?.email_confirmed_at && user.email?.trim().toLowerCase() === adminEmail)
}
