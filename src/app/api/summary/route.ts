import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface SummaryData {
  overview: string
  intent: string
  products: string[]
  keyPoints: string[]
  nextAction: string
  sentiment: 'positive' | 'neutral' | 'inquiry' | 'urgent'
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

  // Extract products/machine keywords
  const knownKeywords = [
    'agarbatti', 'incense', 'dhoop', 'dhoop stick', 'dhoop cone', 'raw material',
    'bamboo stick', 'premix', 'automatic', 'manual', 'semi-automatic',
    'packaging', 'packing', 'dryer', 'grinder', 'mixer', 'powder',
    'hydraulic', 'pouch', 'camphor', 'cotton wick', 'perfume', 'fragrance',
    'coating', 'feeder', 'spare parts', 'motor', 'piston', 'sensor',
    'churan', 'box packing', 'high speed', 'heavy duty'
  ]

  const detectedProducts = new Set<string>()
  if (lead?.machine_interest) {
    detectedProducts.add(lead.machine_interest)
  }

  const fullText = messages.map((m) => m.message || '').join(' ').toLowerCase()
  for (const kw of knownKeywords) {
    if (fullText.includes(kw)) {
      detectedProducts.add(kw.charAt(0).toUpperCase() + kw.slice(1))
    }
  }

  // Detect intent
  let intent = 'General Inquiry & Machine Information'
  let sentiment: 'positive' | 'neutral' | 'inquiry' | 'urgent' = 'inquiry'

  if (fullText.includes('price') || fullText.includes('rate') || fullText.includes('cost') || fullText.includes('quotation') || fullText.includes('kitne')) {
    intent = 'Pricing & Quotation Request'
    sentiment = 'inquiry'
  }
  if (fullText.includes('buy') || fullText.includes('purchase') || fullText.includes('order') || fullText.includes('book') || fullText.includes('payment') || fullText.includes('advance')) {
    intent = 'Ready to Purchase / Booking Stage'
    sentiment = 'positive'
  }
  if (fullText.includes('demo') || fullText.includes('visit') || fullText.includes('factory') || fullText.includes('office') || fullText.includes('address')) {
    intent = 'Factory Visit / Demo Request'
    sentiment = 'positive'
  }
  if (fullText.includes('call me') || fullText.includes('phone') || fullText.includes('urgent') || fullText.includes('jaldi') || fullText.includes('help')) {
    intent = 'Callback / Urgent Assistance Required'
    sentiment = 'urgent'
  }
  if (fullText.includes('not interested') || fullText.includes('cancel') || fullText.includes('no need')) {
    intent = 'Not Interested / Inquiry Closed'
    sentiment = 'neutral'
  }

  // Extract key points
  const keyPoints: string[] = []
  
  if (incomingMsgs.length > 0) {
    const firstIn = incomingMsgs[0].message
    if (firstIn && firstIn.length > 3) {
      keyPoints.push(`Customer initiated inquiry: "${firstIn.slice(0, 100)}${firstIn.length > 100 ? '...' : ''}"`)
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

  if (incomingMsgs.length > 0) {
    const lastIn = incomingMsgs[incomingMsgs.length - 1].message
    if (lastIn && incomingMsgs.length > 1) {
      keyPoints.push(`Latest customer message: "${lastIn.slice(0, 90)}${lastIn.length > 90 ? '...' : ''}"`)
    }
  }

  // Determine next action
  let nextAction = 'Follow up with machine specifications and video demo.'
  if (intent.includes('Pricing') || intent.includes('Quotation')) {
    nextAction = 'Send formal quotation with price breakdown and payment terms.'
  } else if (intent.includes('Purchase') || intent.includes('Booking')) {
    nextAction = 'Confirm invoice details and collect advance payment.'
  } else if (intent.includes('Visit') || intent.includes('Demo')) {
    nextAction = 'Schedule factory visit slot and share location map on WhatsApp.'
  } else if (intent.includes('Callback')) {
    nextAction = 'Call client immediately to discuss technical requirements.'
  }

  // Overview summary text
  const totalCount = messages.length
  const customerName = lead?.name || messages[0]?.phone_number || 'The customer'
  const prodStr = detectedProducts.size > 0 ? Array.from(detectedProducts).slice(0, 3).join(', ') : 'machinery and equipment'
  const overview = `${customerName} engaged in ${totalCount} messages regarding ${prodStr}. Primary intent is ${intent.toLowerCase()}.`

  return {
    overview,
    intent,
    products: Array.from(detectedProducts),
    keyPoints: keyPoints.length > 0 ? keyPoints : ['Discussion on machine specifications and production capacity.'],
    nextAction,
    sentiment,
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
