// ============================================================
// Dynamic Lead Scoring Utility
// Calculates an accurate 0-100 lead score based on customer engagement,
// message flow/responsiveness, inquiry intent, machine interest, and stage.
// ============================================================

export interface LeadScoreParams {
  stage?: string | null
  lead_quality?: string | null
  machine_interest?: string | null
  callback_ready?: string | null
  lead_score?: number | string | null
  conversation_summary?: string | null
  messages?: Array<{
    message?: string
    direction?: 'incoming' | 'outgoing' | string
    timestamp?: string
  }> | null
  intent?: string | null
  sentiment?: string | null
  products?: string[] | null
}

export interface LeadScoreOutput {
  score: number
  label: string
  color: string
  description: string
  factors: string[]
}

const GREETING_WORDS = new Set([
  'hi', 'hello', 'hey', 'hlo', 'hii', 'hiii', 'helo', 'hllo',
  'namaste', 'namaskar', 'pranam', 'good morning', 'good afternoon',
  'good evening', 'test', 'sir', 'bhai', 'ji', '🙏', '👍', 'k', 'ok'
])

const DISINTEREST_TERMS = [
  'not interested', 'nahi chahiye', 'nahi lena', 'cancel', 'wrong number',
  'band karo', 'mat karo', 'dont call', "don't call", 'stop', 'fraud',
  'fake', 'no need', 'not required', 'faltu', 'time pass', 'baad me mat karna'
]

const BUYING_TERMS = [
  'buy', 'kharidna', 'khareedna', 'book', 'booking', 'order', 'advance',
  'payment', 'token', 'account', 'deal', 'lena hai', 'chahiye', 'final',
  'invoice', 'quotation confirm', 'kab bhejoge', 'dispatch'
]

const PRICING_TERMS = [
  'price', 'rate', 'cost', 'quotation', 'quote', 'kitna', 'kitne',
  'bhav', 'rate list', 'price list', 'discount', 'subsidy', 'emi',
  'karcha', 'kharcha', 'budget', 'down payment'
]

const MACHINE_TERMS = [
  'agarbatti', 'incense', 'dhoop', 'dhoop stick', 'dhoop cone', 'raw material',
  'bamboo stick', 'premix', 'automatic', 'manual', 'semi-automatic',
  'packaging', 'packing', 'dryer', 'grinder', 'mixer', 'powder',
  'hydraulic', 'pouch', 'camphor', 'cotton wick', 'perfume', 'fragrance',
  'coating', 'feeder', 'churan', 'box packing', 'high speed', 'heavy duty',
  'motor', 'piston', 'spare parts', 'machine'
]

const VISIT_TERMS = [
  'visit', 'demo', 'factory', 'office', 'kaha aana', 'address',
  'location', 'aana chahta', 'dekhna hai', 'trial', 'live demo',
  'samne dekhna', 'kaha par hai', 'google map', 'pate par'
]

const CALLBACK_TERMS = [
  'call me', 'phone karo', 'baat karni', 'number do', 'urgent call',
  'call back', 'jaldi call', 'call kijiye', 'sampark'
]

export function calculateLeadScore(params: LeadScoreParams): LeadScoreOutput {
  const stage = (params.stage || 'new').toLowerCase().trim()
  const quality = (params.lead_quality || '').toLowerCase().trim()
  const machineInterest = (params.machine_interest || '').trim()
  const callbackReady = String(params.callback_ready || '').toLowerCase().trim() === 'yes'
  const messages = params.messages || []

  // Split messages by direction
  const incomingMsgs = messages.filter((m) => m.direction === 'incoming')
  const outgoingMsgs = messages.filter((m) => m.direction === 'outgoing')

  // Extract texts
  const customerTexts = incomingMsgs.map((m) => (m.message || '').trim().toLowerCase())
  const fullCustomerText = customerTexts.join(' ')
  const allMessagesText = (
    messages.map((m) => m.message || '').join(' ') + ' ' +
    machineInterest + ' ' +
    (params.conversation_summary || '') + ' ' +
    (params.intent || '')
  ).toLowerCase()

  const factors: string[] = []

  // Check for immediate disinterest or closed stages
  const isDisinterested =
    stage === 'not_interested' ||
    stage === 'cancelled' ||
    DISINTEREST_TERMS.some((term) => fullCustomerText.includes(term))

  if (isDisinterested) {
    return {
      score: 15,
      label: 'Cold / Fresh Lead',
      color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      description: 'Customer not interested or inquiry cancelled',
      factors: ['Disinterest or cancellation detected']
    }
  }

  // 1. Stage Base Score
  let score = 15 // Default base for fresh / new leads
  if (['hot_customer', 'confirmed', 'completed', 'booking'].includes(stage)) {
    score = 75
    factors.push(`Stage: ${stage.replace('_', ' ')} (+60)`)
  } else if (['interested', 'callback_done_by_ai'].includes(stage)) {
    score = 60
    factors.push(`Stage: ${stage.replace('_', ' ')} (+45)`)
  } else if (['call_done', 'followup'].includes(stage)) {
    score = 40
    factors.push(`Stage: ${stage.replace('_', ' ')} (+25)`)
  } else if (['low_budget'].includes(stage)) {
    score = 25
    factors.push('Stage: low budget')
  } else if (['not_connected'].includes(stage)) {
    score = 15
    factors.push('Stage: not connected')
  } else {
    factors.push('Stage: new lead')
  }

  // 2. Engagement & Responsiveness Scoring (Key fix for 1-message ghosted leads)
  const incomingCount = incomingMsgs.length
  const outgoingCount = outgoingMsgs.length

  if (incomingCount === 0) {
    // Lead has not sent any message (only outbound campaign sent)
    factors.push('No customer response yet')
  } else if (incomingCount === 1) {
    const firstMsg = customerTexts[0] || ''
    const isOnlyGreeting = GREETING_WORDS.has(firstMsg) || (firstMsg.length <= 4 && !MACHINE_TERMS.some(m => firstMsg.includes(m)))

    if (outgoingCount > 0 && isOnlyGreeting) {
      // Sent 1 greeting, we replied, customer never answered back -> GHOSTED / COLD (15-20 pts total)
      score += 5
      factors.push('Single greeting message only (No follow-up reply)')
    } else if (outgoingCount > 0 && !isOnlyGreeting) {
      // Sent 1 specific question, we replied, no further reply yet
      score += 12
      factors.push('1 specific message sent')
    } else {
      // Just sent 1 message, fresh
      score += 8
      factors.push('Fresh 1st incoming message')
    }
  } else if (incomingCount === 2) {
    // Two-way interaction confirmed (replied back to us)
    score += 20
    factors.push('Two-way conversation (2 customer replies)')
  } else if (incomingCount === 3) {
    score += 30
    factors.push('Active dialogue (3 customer replies)')
  } else {
    // 4 or more messages
    score += 40
    factors.push(`High conversational engagement (${incomingCount} replies)`)
  }

  // 3. High-Intent Content Signals
  // A. Buying / Booking Intent
  const hasBuyingIntent = BUYING_TERMS.some((term) => allMessagesText.includes(term))
  if (hasBuyingIntent) {
    score += 20
    factors.push('Purchase / Booking intent detected (+20)')
  }

  // B. Machine & Product Specifics
  const hasMachineInterest =
    Boolean(machineInterest) ||
    MACHINE_TERMS.some((term) => allMessagesText.includes(term)) ||
    (params.products && params.products.length > 0)

  if (hasMachineInterest) {
    score += 15
    factors.push('Specific machinery interest (+15)')
  }

  // C. Pricing / Quotation Requests
  const hasPricingIntent = PRICING_TERMS.some((term) => allMessagesText.includes(term))
  if (hasPricingIntent) {
    score += 12
    factors.push('Pricing / Quotation inquiry (+12)')
  }

  // D. Factory Visit / Live Demo
  const hasVisitIntent = VISIT_TERMS.some((term) => allMessagesText.includes(term))
  if (hasVisitIntent) {
    score += 15
    factors.push('Factory visit / Demo request (+15)')
  }

  // E. Callback Request
  const hasCallbackIntent = callbackReady || CALLBACK_TERMS.some((term) => allMessagesText.includes(term))
  if (hasCallbackIntent) {
    score += 12
    factors.push('Requested callback / phone talk (+12)')
  }

  // 4. Quality Modifiers
  if (quality.includes('high') || quality.includes('hot')) {
    score += 10
    factors.push('High quality lead tag (+10)')
  } else if (quality.includes('medium') || quality.includes('warm')) {
    score += 5
    factors.push('Medium quality tag (+5)')
  } else if (quality.includes('low') || quality.includes('cold')) {
    score -= 15
    factors.push('Low quality tag (-15)')
  }

  // 5. Special Stage Caps
  if (stage === 'low_budget') {
    score = Math.min(score, 40)
  } else if (stage === 'not_connected') {
    score = Math.min(score, 30)
  }

  // Clamp score between 10 and 98
  score = Math.max(10, Math.min(98, Math.round(score)))

  // Determine UI Label, Color and Description
  let label = 'Warm Lead'
  let color = 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
  let description = 'Medium Engagement'

  if (score >= 75) {
    label = 'Hot Lead'
    color = 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
    description = 'High Conversion Intent'
  } else if (score < 45) {
    label = 'Cold / Fresh Lead'
    color = 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    description = 'Cold / Fresh / Low Interaction'
  }

  return {
    score,
    label,
    color,
    description,
    factors
  }
}
