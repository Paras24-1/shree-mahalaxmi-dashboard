/**
 * Voice Aura AI Call Integration
 * Endpoint: https://voice-aura-production.up.railway.app/api/calls/trigger
 */

export interface TriggerAICallParams {
  phoneNumber: string
  customerName?: string
  leadId?: string
  conversationId?: string
  notes?: string
  organizationId?: string
}

export function formatPhoneNumber(phone: string): { clean: string; formattedWithCountry: string } {
  if (!phone) return { clean: '', formattedWithCountry: '' }
  
  // Remove non-digit characters
  let digits = phone.replace(/\D/g, '')
  
  // If starts with 0, strip it
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  
  // If 10 digits (standard Indian number), prefix with 91
  let formatted = digits
  if (digits.length === 10) {
    formatted = `+91${digits}`
  } else if (digits.length === 12 && digits.startsWith('91')) {
    formatted = `+${digits}`
  } else if (!formatted.startsWith('+')) {
    formatted = `+${digits}`
  }

  return {
    clean: digits.slice(-10),
    formattedWithCountry: formatted,
  }
}

export async function triggerVoiceAICall(params: TriggerAICallParams): Promise<{
  success: boolean
  message: string
  data?: any
  error?: string
}> {
  const { clean, formattedWithCountry } = formatPhoneNumber(params.phoneNumber)
  
  if (!clean || clean.length < 10) {
    return {
      success: false,
      message: 'Invalid phone number provided',
      error: `Invalid phone: ${params.phoneNumber}`,
    }
  }

  const voiceOrgId =
    params.organizationId ||
    process.env.VOICE_SAAS_ORGANIZATION_ID ||
    '9bc1c153-e617-444a-81e1-f3951d4b386b'

  const payload = {
    phoneNumber: formattedWithCountry,
    phone_number: formattedWithCountry,
    to_phone_number: formattedWithCountry,
    phone: formattedWithCountry,
    raw_phone: clean,
    customer_name: params.customerName || 'Customer',
    name: params.customerName || 'Customer',
    organization_id: voiceOrgId,
    lead_id: params.leadId || null,
    conversation_id: params.conversationId || null,
    notes: params.notes || 'Manual CRM follow-up trigger',
    prompt: params.notes || '',
    trigger_source: 'dashboard_manual_followup',
    timestamp: new Date().toISOString(),
  }

  try {
    const res = await fetch('https://voice-aura-production.up.railway.app/api/calls/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await res.text()
    let data: any = {}
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { raw: responseText }
    }

    if (!res.ok) {
      return {
        success: false,
        message: data.error || data.message || `Call trigger failed with status ${res.status}`,
        error: responseText,
        data,
      }
    }

    return {
      success: true,
      message: 'Voice AI call successfully initiated',
      data,
    }
  } catch (err: any) {
    console.error('[Voice Aura Trigger Error]:', err)
    return {
      success: false,
      message: err.message || 'Network error triggering Voice AI call',
      error: String(err),
    }
  }
}
