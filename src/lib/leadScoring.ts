// ============================================================
// Dynamic Lead Scoring Utility
// Calculates an accurate 0-100 lead score strictly based on
// customer (incoming) engagement, responsiveness, intent, and stage.
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

const GREETING_OR_TEMPLATE_PHRASES = [
  'hello! can i get more info on this?',
  'can i get more info on this?',
  'can i get more info',
  "i'm interested in this. can you give me more details?",
  "i'm interested in this",
  'please provide more information',
  'more info',
  'hi',
  'hello',
  'hey',
  'hlo',
  'hii',
  'hiii',
  'helo',
  'hllo',
  'namaste',
  'namaskar',
  'pranam',
  'good morning',
  'good afternoon',
  'good evening',
  'test',
  'sir',
  'bhai',
  'ji',
  'interested',
  'info'
]

const DISINTEREST_TERMS = [
  'not interested', 'nahi chahiye', 'nahi lena', 'cancel', 'wrong number',
  'band karo', 'mat karo', 'dont call', "don't call", 'stop', 'fraud',
  'fake', 'no need', 'not required', 'faltu', 'time pass', 'baad me mat karna'
]

const BUYING_TERMS = [
  'buy', 'kharidna', 'khareedna', 'book', 'booking', 'order', 'advance',
  'payment', 'token', 'account', 'deal', 'lena hai', 'chahiye', 'final',
  'invoice', 'quotation confirm', 'kab bhejoge', 'dispatch', 'deal done'
]

const PRICING_TERMS = [
  'price', 'rate', 'cost', 'quotation', 'quote', 'kitna', 'kitne',
  'bhav', 'rate list', 'price list', 'discount', 'subsidy', 'emi',
  'karcha', 'kharcha', 'budget', 'down payment', 'kitne me'
]

const MACHINE_SPECIFIC_TERMS = [
  'agarbatti', 'incense', 'dhoop', 'dhoop stick', 'dhoop cone', 'raw material',
  'bamboo stick', 'premix', 'automatic', 'semi-automatic', 'semi automatic',
  'packaging', 'packing', 'dryer', 'grinder', 'mixer', 'powder',
  'hydraulic', 'pouch', 'camphor', 'cotton wick', 'perfume', 'fragrance',
  'coating', 'feeder', 'churan', 'box packing', 'high speed', 'heavy duty',
  'piston', 'spare parts', 'motor'
]

const VISIT_TERMS = [
  'visit', 'demo', 'factory', 'office', 'kaha aana', 'address',
  'location', 'aana chahta', 'dekhna hai', 'trial', 'live demo',
  'samne dekhna', 'kaha par hai', 'google map', 'pate par', 'pune aana'
]

const CALLBACK_TERMS = [
  'call me', 'phone karo', 'baat karni', 'number do', 'urgent call',
  'call back', 'jaldi call', 'call kijiye', 'sampark'
]

function isGenericTemplateOrGreeting(text: string): boolean {
  const clean = text.trim().toLowerCase().replace(/[^\w\s\?]/g, '')
  if (!clean || clean.length <= 3) return true
  return GREETING_OR_TEMPLATE_PHRASES.some((phrase) => {
    const cleanPhrase = phrase.replace(/[^\w\s\?]/g, '')
    return clean === cleanPhrase || clean.startsWith(cleanPhrase)
  })
}

export function calculateLeadScore(params: LeadScoreParams): LeadScoreOutput {
  const stage = (params.stage || 'new').toLowerCase().trim()
  const quality = (params.lead_quality || '').toLowerCase().trim()
  const explicitMachine = (params.machine_interest || '').trim()
  const callbackReady = String(params.callback_ready || '').toLowerCase().trim() === 'yes'
  const messages = params.messages || []

  // Filter ONLY customer (incoming) messages for intent
  const incomingMsgs = messages.filter((m) => m.direction === 'incoming')
  const outgoingMsgs = messages.filter((m) => m.direction === 'outgoing')

  const customerTexts = incomingMsgs.map((m) => (m.message || '').trim().toLowerCase())
  const fullCustomerText = customerTexts.join(' ')

  const factors: string[] = []

  // 1. Check for immediate disinterest or closed stages
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

  // 2. Base score from CRM Stage
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

  // 3. Customer Engagement & Reply Responsiveness
  // Deduplicate identical sequential messages (common with Meta Ad double triggers)
  const uniqueCustomerTexts = Array.from(new Set(customerTexts.filter(Boolean)))
  const allCustomerMsgsAreGeneric = uniqueCustomerTexts.length <= 1 && uniqueCustomerTexts.every(isGenericTemplateOrGreeting)

  if (incomingMsgs.length === 0) {
    factors.push('No customer response yet (0 incoming)')
  } else if (allCustomerMsgsAreGeneric) {
    // Customer only clicked the ad or sent "Hi", agent replied, customer NEVER replied back
    score += 5
    factors.push('Initial ad inquiry / greeting only (No customer follow-up reply)')
  } else if (uniqueCustomerTexts.length === 1) {
    // 1 customer message, but contains specific custom text
    score += 10
    factors.push('1 specific customer message sent')
  } else if (uniqueCustomerTexts.length === 2) {
    // Real 2-way dialogue (customer replied after our message)
    score += 20
    factors.push('Two-way active dialogue (2 customer replies)')
  } else if (uniqueCustomerTexts.length === 3) {
    score += 30
    factors.push('Engaged conversation (3 customer replies)')
  } else {
    // 4+ distinct customer responses
    score += 40
    factors.push(`Highly engaged conversation (${uniqueCustomerTexts.length} replies)`)
  }

  // 4. Intent Signals STRICTLY from Customer Messages or Explicit Lead Data
  // A. Buying / Booking Intent
  const hasBuyingIntent = BUYING_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasBuyingIntent) {
    score += 20
    factors.push('Purchase / Booking intent from customer (+20)')
  }

  // B. Specific Machine Mentions in customer text or explicit CRM field
  const hasSpecificMachine =
    Boolean(explicitMachine) ||
    MACHINE_SPECIFIC_TERMS.some((term) => fullCustomerText.includes(term))

  if (hasSpecificMachine) {
    score += 15
    factors.push('Customer specified machinery model (+15)')
  }

  // C. Pricing / Quotation Requests in customer text
  const hasPricingIntent = PRICING_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasPricingIntent) {
    score += 12
    factors.push('Pricing / Quotation inquiry from customer (+12)')
  }

  // D. Factory Visit / Live Demo Request in customer text
  const hasVisitIntent = VISIT_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasVisitIntent) {
    score += 15
    factors.push('Factory visit / Demo request (+15)')
  }

  // E. Callback Request from customer
  const hasCallbackIntent = callbackReady || CALLBACK_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasCallbackIntent) {
    score += 12
    factors.push('Customer requested phone callback (+12)')
  }

  // 5. Quality Modifiers
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

  // 6. Stage Caps
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
    description = 'Cold / Fresh / 1-Message Lead'
  }

  return {
    score,
    label,
    color,
    description,
    factors
  }
}

export function getLeadScore(lead: any): LeadScoreOutput {
  if (!lead) {
    return {
      score: 15,
      label: 'Cold / Fresh Lead',
      color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
      description: 'Cold / Fresh / 1-Message Lead',
      factors: []
    }
  }
  return calculateLeadScore({
    stage: lead.stage,
    lead_quality: lead.lead_quality,
    machine_interest: lead.machine_interest,
    callback_ready: lead.callback_ready,
    lead_score: lead.lead_score,
    conversation_summary: lead.conversation_summary,
    messages: lead.last_message ? [{ message: lead.last_message, direction: 'incoming' }] : [],
    intent: lead.intent,
    sentiment: lead.sentiment,
    products: lead.products,
  })
}

export function getLeadScoreValue(lead: any): number {
  return getLeadScore(lead).score
}

