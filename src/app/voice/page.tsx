'use client'

import dynamic from 'next/dynamic'

const AnalyticsPage = dynamic(() => import('@/app/analytics/page'), { ssr: false })

export default function VoicePage() {
  return <AnalyticsPage />
}
