import type { Job } from '@/types/database'
import type { JobErrorCode } from '../../shared/job-errors'

export { getJobErrorCode, isCalendarReauthErrorCode, jobErrorMessage } from '../../shared/job-errors'

export const JOB_SUMMARY_COLUMNS = 'id,status,created_at,pdf_title,result_data'
export type JobSummary = Pick<Job, 'id' | 'status' | 'created_at' | 'pdf_title' | 'result_data'>
export type JobResultDataLike = {
  registration_mode?: 'auto' | 'review'
  review_available?: boolean
  calendar_event_count?: number
  skipped_count?: number
  error_code?: JobErrorCode
}
