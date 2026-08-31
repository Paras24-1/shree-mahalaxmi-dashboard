// ============================================================
// Dynamic Lead Scoring Utility
// Calculates an accurate 0-100 lead score based on:
// 1. Budget: >= 5-6 Lakhs gives high score (>70%), low budget gives lower score.
// 2. Questions & Quotations: Asking more questions/quotations gives high score, asking less gives lower score.
// 3. Customer Engagement, Stage, and Intent.
// ============================================================

export interface LeadScoreParams {
  stage?: string | null
  lead_quality?: string | null
  machine_interest?: string | null
  callback_ready?: string | null
  lead_score?: number | string | null
  conversation_summary?: string | null
  notes?: string | null
  followup_notes?: string | null
  messages?: Array<{
    message?: string
    direction?: 'incoming' | 'outgoing' | string
    timestamp?: string
  }> | null
  intent?: string | null
  sentiment?: string | null
  products?: string[] | null
  budget?: number | string | null
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
  'karcha', 'kharcha', 'budget', 'down payment', 'kitne me', 'proforma',
  'estimate', 'costing', 'rate sheet', 'quotation bhejo'
]

const QUESTION_INQUIRY_TERMS = [
  'kya', 'kaise', 'kab', 'kitna', 'kitne', 'kaha', 'kaisa', 'kis', 'konsa', 'kaunsa',
  'specs', 'specification', 'details', 'capacity', 'video', 'photo', 'catalog', 'brochure',
  'warranty', 'guarantee', 'service', 'delivery', 'dispatch', 'transport', 'gst',
  'subsidy', 'loan', 'raw material', 'speed', 'production', 'motor', 'die', 'feeder',
  'automatic', 'semi-automatic', 'model', 'photo bhejo', 'video bhejo', 'quotation bhejo',
  'rate bhejo', 'price batao', 'kitne ka hai', 'sample', 'demo'
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

// ----------------------------------------------------
// Budget Detection Helper
// ----------------------------------------------------
function detectBudgetDetails(combinedText: string, stage: string, explicitBudget?: number | string | null) {
  const text = combinedText.toLowerCase()
  let isHighBudget = false
  let isLowBudget = false
  let detectedAmount = ''

  if (explicitBudget) {
    const num = Number(String(explicitBudget).replace(/[^0-9.]/g, ''))
    if (!isNaN(num)) {
      if (num >= 500000 || (num >= 5 && num <= 100)) {
        isHighBudget = true
        detectedAmount = `${num >= 500000 ? num / 100000 : num} Lakhs`
      } else if (num > 0 && num < 100000) {
        isLowBudget = true
        detectedAmount = `< 1 Lakh`
      }
    }
  }

  // Check High Budget (>= 5 - 6 Lakhs) Regex Patterns
  const highBudgetRegexes = [
    /(?:budget|invest|investment|amount|ke\s*paas|paise)\s*(?:is|hai|around|approx|upto|above|more\s*than)?\s*(?:rs\.?|₹|inr)?\s*([5-9]|[1-9][0-9]+)\s*(?:lakh|lakhs|lac|lacs|l\b|cr|crore)/i,
    /([5-9]|[1-9][0-9]+)\s*(?:lakh|lakhs|lac|lacs|cr|crore)\s*(?:budget|lagana|investment|chahiye|tak|ka)?/i,
    /(?:5|6|7|8|9|10|12|15|20|25|30|50)\s*(?:lakh|lakhs|lac|lacs|l\b)/i,
    /(?:500000|600000|700000|800000|900000|1000000|1500000|2000000|5,00,000|6,00,000|7,00,000|10,00,000)/i,
    /(?:5\s*-\s*6\s*lakh|5\s*to\s*6\s*lakh|6\s*-\s*7\s*lakh|5\s*-\s*10\s*lakh|high\s*budget|complete\s*plant|industrial\s*plant|full\s*automatic\s*plant)/i,
  ]

  for (const reg of highBudgetRegexes) {
    if (reg.test(text)) {
      isHighBudget = true
      const match = text.match(reg)
      if (match) detectedAmount = match[0]
      break
    }
  }

  // Check Low Budget Patterns (< 1-2 Lakhs / Kam budget / 10k - 50k)
  const lowBudgetRegexes = [
    /(?:low\s*budget|kam\s*budget|kam\s*paise|budget\s*kam|saste\s*me|sasta|chota\s*budget)/i,
    /(?:10|15|20|25|30|35|40|50)\s*(?:k|thousand|hazar)\b/i,
    /(?:10000|15000|20000|25000|30000|40000|50000)\b/i,
    /(?:under\s*50k|under\s*1\s*lakh|10-20k|20-30k)/i,
  ]

  if (stage === 'low_budget') {
    isLowBudget = true
  } else if (!isHighBudget) {
    for (const reg of lowBudgetRegexes) {
      if (reg.test(text)) {
        isLowBudget = true
        const match = text.match(reg)
        if (match) detectedAmount = match[0]
        break
      }
    }
  }

  return { isHighBudget, isLowBudget, detectedAmount }
}

// ----------------------------------------------------
// Question & Quotation Volume Analyzer
// ----------------------------------------------------
function analyzeQuestionsAndQuotations(incomingMsgs: any[], fullCustomerText: string) {
  let questionCount = 0
  let quotationCount = 0

  // 1. Count question marks in customer messages
  incomingMsgs.forEach((m) => {
    const text = (m.message || '').trim()
    const marks = (text.match(/\?/g) || []).length
    questionCount += marks > 0 ? marks : 0
  })

  // 2. Count inquiry keywords in customer text
  QUESTION_INQUIRY_TERMS.forEach((term) => {
    if (fullCustomerText.includes(term)) {
      questionCount++
    }
  })

  // 3. Count explicit quotation / price requests
  PRICING_TERMS.forEach((term) => {
    if (fullCustomerText.includes(term)) {
      quotationCount++
    }
  })

  return { questionCount, quotationCount }
}

export function calculateLeadScore(params: LeadScoreParams): LeadScoreOutput {
  const stage = (params.stage || 'new').toLowerCase().trim()
  const quality = (params.lead_quality || '').toLowerCase().trim()
  const explicitMachine = (params.machine_interest || '').trim()
  const callbackReady = String(params.callback_ready || '').toLowerCase().trim() === 'yes'
  const messages = params.messages || []

  // Filter customer (incoming) messages for intent
  const incomingMsgs = messages.filter((m) => m.direction === 'incoming')
  const customerTexts = incomingMsgs.map((m) => (m.message || '').trim().toLowerCase())
  const fullCustomerText = [
    ...customerTexts,
    (params.conversation_summary || '').toLowerCase(),
    (params.notes || '').toLowerCase(),
    (params.followup_notes || '').toLowerCase(),
  ].join(' ')

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

  // 3. BUDGET ANALYSIS (User Rule: Budget >= 5 or 6 Lakhs -> Score > 70%, Low Budget -> Less Score)
  const budgetInfo = detectBudgetDetails(fullCustomerText, stage, params.budget)
  if (budgetInfo.isHighBudget) {
    score += 35
    // Guarantee score is at least 75 (> 70%) when budget >= 5-6 Lakhs
    score = Math.max(score, 75)
    factors.push(`🔥 High Budget Detected (≥ 5-6 Lakhs / ${budgetInfo.detectedAmount || '5L+'}) -> High Score (>70%)`)
  } else if (budgetInfo.isLowBudget) {
    score -= 25
    factors.push('📉 Low Budget Inquiry (< 1-2 Lakhs / Kam budget) (-25)')
  }

  // 4. QUESTIONS & QUOTATIONS ANALYSIS (User Rule: More questions/quotations -> High Score, Less -> Less Score)
  const { questionCount, quotationCount } = analyzeQuestionsAndQuotations(incomingMsgs, fullCustomerText)
  const uniqueCustomerTexts = Array.from(new Set(customerTexts.filter(Boolean)))
  const allCustomerMsgsAreGeneric = uniqueCustomerTexts.length <= 1 && uniqueCustomerTexts.every(isGenericTemplateOrGreeting)

  if (incomingMsgs.length === 0) {
    factors.push('No customer response yet (0 incoming)')
  } else if (allCustomerMsgsAreGeneric && questionCount === 0 && quotationCount === 0) {
    // Only 1 generic greeting/ad template, no questions asked -> lower score
    score -= 10
    factors.push('Initial greeting / ad click only (0 specific questions asked) (-10)')
  } else if (questionCount >= 3 || quotationCount >= 2) {
    // Asked multiple detailed questions / quotations -> high score boost
    score += 30
    factors.push(`💬 High Question & Quotation Engagement (${questionCount} questions / quotes asked) (+30)`)
  } else if (questionCount >= 1 || quotationCount >= 1) {
    // Asked 1-2 questions / quotation -> moderate boost
    score += 15
    factors.push(`Inquired with quotation / specifications questions (+15)`)
  }

  // 5. Customer Engagement & Dialogue Depth
  if (uniqueCustomerTexts.length >= 4) {
    score += 25
    factors.push(`Highly engaged conversation (${uniqueCustomerTexts.length} replies) (+25)`)
  } else if (uniqueCustomerTexts.length >= 2) {
    score += 15
    factors.push(`Two-way active dialogue (${uniqueCustomerTexts.length} replies) (+15)`)
  } else if (uniqueCustomerTexts.length === 1 && !allCustomerMsgsAreGeneric) {
    score += 8
    factors.push('Specific custom customer message sent (+8)')
  }

  // 6. Buying / Machinery / Visit / Callback Intent Signals
  const hasBuyingIntent = BUYING_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasBuyingIntent) {
    score += 20
    factors.push('Purchase / Booking intent from customer (+20)')
  }

  const hasSpecificMachine =
    Boolean(explicitMachine) ||
    MACHINE_SPECIFIC_TERMS.some((term) => fullCustomerText.includes(term))

  if (hasSpecificMachine) {
    score += 15
    factors.push('Customer specified machinery model (+15)')
  }

  const hasVisitIntent = VISIT_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasVisitIntent) {
    score += 15
    factors.push('Factory visit / Demo request (+15)')
  }

  const hasCallbackIntent = callbackReady || CALLBACK_TERMS.some((term) => fullCustomerText.includes(term))
  if (hasCallbackIntent) {
    score += 12
    factors.push('Customer requested phone callback (+12)')
  }

  // 7. Quality Modifiers
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

  // 8. Enforce Caps & Floors
  if (budgetInfo.isHighBudget) {
    // High budget leads are strictly guaranteed to be >= 72%
    score = Math.max(72, score)
  } else if (budgetInfo.isLowBudget || stage === 'low_budget') {
    score = Math.min(score, 38)
  } else if (stage === 'not_connected') {
    score = Math.min(score, 30)
  }

  // Clamp score between 10 and 98
  score = Math.max(10, Math.min(98, Math.round(score)))

  // Determine UI Label, Color and Description
  let label = 'Warm Lead'
  let color = 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
  let description = 'Medium Engagement'

  if (score >= 70) {
    label = 'Hot Lead'
    color = 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
    description = budgetInfo.isHighBudget
      ? 'High Budget (≥ 5-6 Lakhs) & Conversion Intent'
      : 'High Engagement & Conversion Intent'
  } else if (score < 45) {
    label = 'Cold / Fresh Lead'
    color = 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
    description = budgetInfo.isLowBudget
      ? 'Low Budget Lead (< 1-2 Lakhs)'
      : 'Cold / Fresh / 1-Message Lead'
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
    notes: lead.notes,
    followup_notes: lead.followup_notes,
    messages: lead.last_message ? [{ message: lead.last_message, direction: 'incoming' }] : [],
    intent: lead.intent,
    sentiment: lead.sentiment,
    products: lead.products,
    budget: lead.budget || lead.lead_budget,
  })
}

export function getLeadScoreValue(lead: any): number {
  return getLeadScore(lead).score
}

