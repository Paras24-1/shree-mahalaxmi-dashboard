import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calculateLeadScore, LeadScoreOutput } from '@/lib/leadScoring'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface SummaryData {
  overview: string
  intent: string
  products: string[]
  keyPoints: string[]
  nextAction: string
  sentiment: 'positive' | 'neutral' | 'inquiry' | 'urgent'
  leadScore?: LeadScoreOutput
}

function generateSmartSummary(messages: any[], lead: any): SummaryData {
  if (!messages || messages.length === 0) {
    return {
      overview: 'No messages exchanged yet in this conversation.',
      intent: 'New Lead / No interaction',
      products: [],
      keyPoints: ['Conversation initiated, awaiting first customer message.'],
      nextAction: 'Send a welcoming WhatsApp message or product catalog.',
      sentiment: 'neutral',
    }
  }

  const incomingMsgs = messages.filter((m) => m.direction === 'incoming')
  const outgoingMsgs = messages.filter((m) => m.direction === 'outgoing')

  // Extract products/machine keywords ONLY from customer (incoming) messages or lead profile
  const knownKeywords = [
    'agarbatti', 'incense', 'dhoop', 'dhoop stick', 'dhoop cone', 'raw material',
    'bamboo stick', 'premix', 'automatic', 'semi-automatic', 'semi automatic',
    'packaging', 'packing', 'dryer', 'grinder', 'mixer', 'powder',
    'hydraulic', 'pouch', 'camphor', 'cotton wick', 'perfume', 'fragrance',
    'coating', 'feeder', 'spare parts', 'motor', 'piston', 'sensor',
    'churan', 'box packing', 'high speed', 'heavy duty'
  ]

  const detectedProducts = new Set<string>()
  if (lead?.machine_interest && String(lead.machine_interest).trim()) {
    detectedProducts.add(lead.machine_interest.trim())
  }

  const customerText = incomingMsgs.map((m) => m.message || '').join(' ').toLowerCase()
  for (const kw of knownKeywords) {
    if (customerText.includes(kw)) {
      detectedProducts.add(kw.charAt(0).toUpperCase() + kw.slice(1))
    }
  }

  // Check if customer only sent ad template / greeting
  const isTemplateOrGreeting =
    customerText.includes('can i get more info') ||
    customerText.includes('more info on this') ||
    customerText.includes('more information') ||
    customerText.trim() === 'hi' ||
    customerText.trim() === 'hello' ||
    customerText.trim() === 'namaste' ||
    customerText.trim() === 'interested' ||
    customerText.length <= 5

  // Detect intent strictly from customer text
  let intent = isTemplateOrGreeting ? 'Initial Ad Inquiry (1-Message / Awaiting Reply)' : 'General Inquiry'
  let sentiment: 'positive' | 'neutral' | 'inquiry' | 'urgent' = isTemplateOrGreeting ? 'neutral' : 'inquiry'

  if (customerText.includes('price') || customerText.includes('rate') || customerText.includes('cost') || customerText.includes('quotation') || customerText.includes('kitne') || customerText.includes('kitna')) {
    intent = 'Pricing & Quotation Request'
    sentiment = 'inquiry'
  } else if (customerText.includes('buy') || customerText.includes('purchase') || customerText.includes('order') || customerText.includes('book') || customerText.includes('payment') || customerText.includes('advance') || customerText.includes('kharidna')) {
    intent = 'Ready to Purchase / Booking Stage'
    sentiment = 'positive'
  } else if (customerText.includes('demo') || customerText.includes('visit') || customerText.includes('factory') || customerText.includes('office') || customerText.includes('address') || customerText.includes('kaha aana')) {
    intent = 'Factory Visit / Demo Request'
    sentiment = 'positive'
  } else if (customerText.includes('call me') || customerText.includes('phone') || customerText.includes('urgent') || customerText.includes('jaldi') || customerText.includes('help') || customerText.includes('baat karni')) {
    intent = 'Callback / Urgent Assistance Required'
    sentiment = 'urgent'
  } else if (customerText.includes('not interested') || customerText.includes('cancel') || customerText.includes('no need') || customerText.includes('nahi chahiye')) {
    intent = 'Not Interested / Inquiry Closed'
    sentiment = 'neutral'
  }

  // Extract key points
  const keyPoints: string[] = []
  
  if (incomingMsgs.length > 0) {
    const firstIn = incomingMsgs[0].message
    if (firstIn && firstIn.length > 3) {
      keyPoints.push(`Customer inquiry: "${firstIn.slice(0, 100)}${firstIn.length > 100 ? '...' : ''}"`)
    }
  }

  if (detectedProducts.size > 0) {
    keyPoints.push(`Interest shown in: ${Array.from(detectedProducts).slice(0, 4).join(', ')}`)
  }

  if (outgoingMsgs.length > 0) {
    const lastOut = outgoingMsgs[outgoingMsgs.length - 1].message
    if (lastOut && lastOut.length > 3) {
      keyPoints.push(`Latest agent reply: "${lastOut.slice(0, 90)}${lastOut.length > 90 ? '...' : ''}"`)
    }
  }

  if (incomingMsgs.length > 1) {
    const lastIn = incomingMsgs[incomingMsgs.length - 1].message
    if (lastIn && lastIn !== incomingMsgs[0].message) {
      keyPoints.push(`Latest customer follow-up: "${lastIn.slice(0, 90)}${lastIn.length > 90 ? '...' : ''}"`)
    }
  }

  // Determine next action
  let nextAction = 'Send product catalog and follow up via WhatsApp or call.'
  if (intent.includes('Pricing') || intent.includes('Quotation')) {
    nextAction = 'Send formal quotation with price breakdown and payment terms.'
  } else if (intent.includes('Purchase') || intent.includes('Booking')) {
    nextAction = 'Confirm invoice details and collect advance payment.'
  } else if (intent.includes('Visit') || intent.includes('Demo')) {
    nextAction = 'Schedule factory visit slot and share location map on WhatsApp.'
  } else if (intent.includes('Callback')) {
    nextAction = 'Call client immediately to discuss requirements.'
  }

  // Overview summary text
  const totalCount = messages.length
  const customerName = lead?.name || messages[0]?.phone_number || 'The customer'
  const prodStr = detectedProducts.size > 0 ? Array.from(detectedProducts).slice(0, 3).join(', ') : 'machinery catalog'
  const overview = isTemplateOrGreeting && incomingMsgs.length <= 2 && outgoingMsgs.length > 0
    ? `${customerName} clicked an initial ad inquiry. No customer reply after our welcome message yet.`
    : `${customerName} engaged in ${totalCount} messages regarding ${prodStr}. Primary intent is ${intent.toLowerCase()}.`

  // Calculate interest-based lead score
  const leadScoreResult = calculateLeadScore({
    stage: lead?.stage,
    lead_quality: lead?.lead_quality,
    machine_interest: lead?.machine_interest,
    callback_ready: lead?.callback_ready,
    conversation_summary: lead?.conversation_summary,
    messages: messages,
    intent,
    sentiment,
    products: Array.from(detectedProducts),
  })

  return {
    overview,
    intent,
    products: Array.from(detectedProducts),
    keyPoints: keyPoints.length > 0 ? keyPoints : ['Discussion on machine specifications and production capacity.'],
    nextAction,
    sentiment,
    leadScore: leadScoreResult,
  }
}

// GET /api/summary?conversation_id=xxx
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    let conversationId = searchParams.get('conversation_id')
    const phone = searchParams.get('phone')

    // If conversationId is not provided, look up by phone number
    if (!conversationId && phone) {
      const clean = phone.replace(/\D/g, '').slice(-10)
      if (clean) {
        const { data: conv } = await supabaseAdmin
          .from('conversations')
          .select('id')
          .ilike('phone_number', `%${clean}%`)
          .limit(1)
          .maybeSingle()
        if (conv?.id) {
          conversationId = conv.id
        }
      }
    }

    if (!conversationId && !phone) {
      return NextResponse.json({ error: 'conversation_id or phone is required' }, { status: 400 })
    }

    // 1. Fetch messages
    let messages: any[] = []
    if (conversationId) {
      const { data: msgData, error: msgError } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: true })

      if (!msgError && msgData) {
        messages = msgData
      }
    }

    // 2. Fetch lead info
    let lead = null
    if (conversationId) {
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('conversation_id', conversationId)
        .maybeSingle()
      lead = leadData
    } else if (phone) {
      const clean = phone.replace(/\D/g, '').slice(-10)
      const { data: leadData } = await supabaseAdmin
        .from('leads')
        .select('*')
        .ilike('phone_number', `%${clean}%`)
        .maybeSingle()
      lead = leadData
    }

    // 3. Generate summary
    const summary = generateSmartSummary(messages || [], lead)

    return NextResponse.json({
      success: true,
      summary,
      messageCount: messages?.length || 0,
      savedSummary: lead?.conversation_summary || null,
    })
  } catch (err: any) {
    console.error('[summary GET error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/summary — save / update summary in DB
export async function POST(req: NextRequest) {
  try {
    const { conversation_id, summary_text } = await req.json()

    if (!conversation_id || !summary_text) {
      return NextResponse.json({ error: 'conversation_id and summary_text required' }, { status: 400 })
    }

    // 1. Update in leads table
    await supabaseAdmin
      .from('leads')
      .update({ conversation_summary: summary_text })
      .eq('conversation_id', conversation_id)

    // 2. Update in conversations table (notes)
    await supabaseAdmin
      .from('conversations')
      .update({ notes: summary_text })
      .eq('id', conversation_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[summary POST error]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
