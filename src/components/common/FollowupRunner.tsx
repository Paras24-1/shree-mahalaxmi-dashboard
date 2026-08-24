'use client'

import { useEffect } from 'react'

/**
 * FollowupRunner
 * Periodically checks for due follow-ups every 30 seconds while the CRM is open.
 * When a follow-up date/time is reached, automatically triggers the Voice AI call.
 */
export default function FollowupRunner() {
  useEffect(() => {
    const checkDueCalls = async () => {
      try {
        await fetch('/api/calls/check-scheduled', { method: 'POST' })
      } catch (err) {
        // Silently catch background poll error
      }
    }

    // Run once on load
    checkDueCalls()

    // Poll every 30 seconds
    const interval = setInterval(checkDueCalls, 30_000)

    return () => clearInterval(interval)
  }, [])

  return null
}
