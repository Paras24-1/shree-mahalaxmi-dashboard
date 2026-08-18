'use client'

import { redirect } from 'next/navigation'
import { useEffect } from 'react'

export default function InvoiceAddPage() {
  useEffect(() => {
    window.location.href = '/invoice'
  }, [])
  return null
}
