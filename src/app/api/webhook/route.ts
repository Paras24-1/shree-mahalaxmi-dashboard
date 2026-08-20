import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

function extractWebhookData(body: any) {
  if (!body || typeof body !== 'object') {
    return null
  }

  let phoneNumber: string | null = null
  let messageText: string = ''
  let direction: 'incoming' | 'outgoing' = 'incoming'
  let name: string | null = null
  let mediaUrl: string | null = null
  let mediaType: string | null = null
  let callbackReady: string | null = null
  let leadQuality: string | null = null
  let source: string = 'WhatsApp Direct'

  // 1. Meta WhatsApp Cloud API nested format (handles both Meta Ads and Direct WhatsApp)
  if (body.entry?.[0]?.changes?.[0]?.value) {
    const value = body.entry[0].changes[0].value
    const metaContact = value.contacts?.[0]
    const metaMsg = value.messages?.[0]

    if (metaMsg) {
      phoneNumber = metaMsg.from || metaContact?.wa_id || null
      name = metaContact?.profile?.name || null
      direction = 'incoming'

      if (metaMsg.referral) {
        source = 'Meta Ads'
      } else {
        source = 'WhatsApp Direct'
      }

      if (metaMsg.type === 'text') {
        messageText = metaMsg.text?.body || ''
      } else if (metaMsg.type === 'image') {
        messageText = metaMsg.image?.caption || '📸 Image'
        mediaType = metaMsg.image?.mime_type || 'image/jpeg'
        mediaUrl = metaMsg.image?.id ? `https://graph.facebook.com/${metaMsg.image.id}` : null
      } else if (metaMsg.type === 'audio' || metaMsg.type === 'voice') {
        messageText = '🎵 Voice Note'
        mediaType = metaMsg.audio?.mime_type || metaMsg.voice?.mime_type || 'audio/ogg'
        mediaUrl = metaMsg.audio?.id ? `https://graph.facebook.com/${metaMsg.audio.id}` : null
      } else if (metaMsg.type === 'document') {
        messageText = `📄 ${metaMsg.document?.filename || 'Document'}`
        mediaType = metaMsg.document?.mime_type || 'application/pdf'
        mediaUrl = metaMsg.document?.id ? `https://graph.facebook.com/${metaMsg.document.id}` : null
      } else if (metaMsg.type === 'video') {
        messageText = metaMsg.video?.caption || '🎥 Video'
        mediaType = metaMsg.video?.mime_type || 'video/mp4'
        mediaUrl = metaMsg.video?.id ? `https://graph.facebook.com/${metaMsg.video.id}` : null
      } else if (metaMsg.type === 'location') {
        const loc = metaMsg.location
        messageText = `📍 Location: ${loc?.name || loc?.address || `${loc?.latitude}, ${loc?.longitude}`}`
      } else if (metaMsg.type === 'contacts') {
        const cName = metaMsg.contacts?.[0]?.name?.formatted_name || 'Contact card'
        const cPhone = metaMsg.contacts?.[0]?.phones?.[0]?.phone || ''
        messageText = `👤 Contact: ${cName} ${cPhone}`
      } else if (metaMsg.type === 'sticker') {
        messageText = '🏷️ Sticker'
      } else if (metaMsg.type === 'interactive') {
        messageText =
          metaMsg.interactive?.button_reply?.title ||
          metaMsg.interactive?.list_reply?.title ||
          '[Interactive Response]'
      } else if (metaMsg.type === 'button') {
        messageText = metaMsg.button?.text || '[Button Response]'
      } else if (metaMsg.type === 'reaction') {
        messageText = `Reacted ${metaMsg.reaction?.emoji || '👍'}`
      } else {
        messageText = `[${metaMsg.type || 'Message'}]`
        mediaType = metaMsg.type
      }
    }
  }
  // 2. Evolution API / Baileys nested format
  else if (body.data?.key || body.data?.message) {
    const data = body.data
    const remoteJid = data.key?.remoteJid || data.phone || ''
    phoneNumber = remoteJid.replace(/@.+/, '')
    name = data.pushName || data.name || null
    direction = data.key?.fromMe ? 'outgoing' : 'incoming'
    messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      data.message?.imageMessage?.caption ||
      data.messageText ||
      data.body ||
      ''
    mediaUrl = data.mediaUrl || data.media_url || null
    mediaType = data.mediaType || data.media_type || null
    source = body.source || 'WhatsApp Direct'
  }

  // 3. Fallback / Flat formats (e.g. n8n standard or custom webhook payload)
  if (!phoneNumber) {
    phoneNumber =
      body.phone_number ||
      body.phoneNumber ||
      body.phone ||
      body.from ||
      body.wa_id ||
      body.sender ||
      body.number ||
      body.mobile ||
      body.contact ||
      null
  }

  if (!messageText) {
    messageText =
      body.message ||
      body.text ||
      body.body ||
      body.msg ||
      body.caption ||
      body.content ||
      (body.media_type || body.mediaType ? `[${body.media_type || body.mediaType}]` : '')
  }

  if (!name) {
    name =
      body.name ||
      body.pushName ||
      body.pushname ||
      body.sender_name ||
      body.senderName ||
      body.profile_name ||
      body.contact_name ||
      null
  }

  if (body.direction) {
    const dir = String(body.direction).toLowerCase()
    direction = dir === 'outgoing' || dir === 'sent' || dir === 'outbound' ? 'outgoing' : 'incoming'
  } else if (body.fromMe === true || body.from_me === true) {
    direction = 'outgoing'
  }

  if (!mediaUrl) {
    mediaUrl = body.media_url || body.mediaUrl || body.image_url || body.imageUrl || body.url || null
  }
  if (!mediaType) {
    mediaType = body.media_type || body.mediaType || body.mime_type || body.mimeType || null
  }

  callbackReady = body.callback_ready || body.callbackReady || null
  leadQuality = body.lead_quality || body.leadQuality || null
  if (body.source) {
    source = body.source
  }

  if (!phoneNumber) {
    return null
  }

  // Clean phone number: remove @s.whatsapp.net / @c.us if present, strip spaces/dashes
  const cleanPhone = String(phoneNumber).trim().replace(/@.+/, '').replace(/[\s\-\(\)]/g, '')

  return {
    phoneNumber: cleanPhone,
    messageText: String(messageText || ''),
    direction,
    name: name ? String(name).trim() : null,
    mediaUrl,
    mediaType,
    callbackReady,
    leadQuality,
    source,
  }
}

async function getNextEmployee(): Promise<string | null> {
  try {
    const { data: employees, error } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'employee')
      .or('is_active.eq.true,is_active.is.null')
      .order('created_at', { ascending: true })

    if (error || !employees || employees.length === 0) return null

    // Get the last assigned conversation to find who was assigned last
    const { data: lastAssigned } = await supabaseAdmin
      .from('conversations')
      .select('assigned_to')
      .not('assigned_to', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const lastEmployeeId = lastAssigned?.assigned_to
    const lastIndex = employees.findIndex((e) => e.id === lastEmployeeId)
    const nextIndex = (lastIndex + 1) % employees.length

    return employees[nextIndex].id
  } catch (e) {
    console.error('[webhook getNextEmployee]', e)
    return null
  }
}

// GET endpoint for Meta WhatsApp Cloud API webhook verification
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('hub.mode')
    const token = searchParams.get('hub.verify_token')
    const challenge = searchParams.get('hub.challenge')

    const secret = process.env.N8N_WEBHOOK_SECRET || ''

    if (mode === 'subscribe' && (!secret || token === secret)) {
      return new NextResponse(challenge || 'OK', { status: 200 })
    }

    return NextResponse.json({ status: 'Webhook endpoint active' }, { status: 200 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const extracted = extractWebhookData(body)

    if (!extracted || !extracted.phoneNumber) {
      console.warn('[webhook] Missing phone_number in payload:', body)
      return NextResponse.json(
        { error: 'Missing phone_number in payload', received: body },
        { status: 400 }
      )
    }

    const {
      phoneNumber,
      messageText,
      direction,
      name,
      mediaUrl,
      mediaType,
      callbackReady,
      leadQuality,
      source,
    } = extracted

    const nowIso = new Date().toISOString()
    const msgText = messageText || (mediaType ? `[${mediaType}]` : '')

    // 1. Check if conversation already exists (matching canonical format or alternate + prefix)
    const phoneCandidates = [
      phoneNumber,
      phoneNumber.startsWith('+') ? phoneNumber.slice(1) : `+${phoneNumber}`,
    ]

    const { data: existingList } = await supabaseAdmin
      .from('conversations')
      .select('id, phone_number, name, assigned_to, unread_count')
      .in('phone_number', phoneCandidates)
      .limit(1)

    const existing = existingList && existingList.length > 0 ? existingList[0] : null
    const targetPhoneNumber = existing?.phone_number || phoneNumber
    const contactName = name || existing?.name || targetPhoneNumber

    // 2. Get next employee only for NEW unassigned conversations
    let assignedTo = existing?.assigned_to || null
    if (direction === 'incoming' && !assignedTo) {
      assignedTo = await getNextEmployee()
    }

    const newUnreadCount =
      direction === 'incoming'
        ? ((existing?.unread_count || 0) + 1)
        : (existing?.unread_count || 0)

    console.log('[webhook processing]', {
      targetPhoneNumber,
      direction,
      source,
      msgText,
      existingId: existing?.id,
      assignedTo,
    })

    // 3. Upsert conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .upsert(
        {
          phone_number: targetPhoneNumber,
          name: contactName,
          last_message: msgText,
          unread_count: newUnreadCount,
          updated_at: nowIso,
          ...(callbackReady === 'yes' ? { stage: 'callback_done_by_ai' } : {}),
          ...(assignedTo
            ? { assigned_to: assignedTo, assignment_status: 'assigned' }
            : {}),
        },
        { onConflict: 'phone_number' }
      )
      .select()
      .single()

    if (convError) {
      console.error('[webhook convError]', convError)
      throw convError
    }

    // 4. Insert message into messages table
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        phone_number: targetPhoneNumber,
        message: msgText,
        direction,
        timestamp: nowIso,
        media_url: mediaUrl || null,
        media_type: mediaType || null,
      })
      .select()
      .single()

    if (msgError) {
      console.error('[webhook msgError]', msgError)
      throw msgError
    }

    // 5. Upsert lead safely (non-blocking)
    try {
      await supabaseAdmin
        .from('leads')
        .upsert(
          {
            conversation_id: conversation.id,
            phone_number: targetPhoneNumber,
            name: contactName,
            source: source || 'WhatsApp Direct',
            ...(callbackReady === 'yes' ? { stage: 'callback_done_by_ai' } : {}),
            ...(leadQuality ? { lead_quality: leadQuality } : {}),
          },
          { onConflict: 'conversation_id' }
        )
    } catch (leadErr) {
      console.warn('[webhook lead upsert warning]', leadErr)
    }

    // 6. Log assignment if new conversation was assigned safely (non-blocking)
    if (!existing && assignedTo) {
      try {
        await supabaseAdmin
          .from('conversation_assignments')
          .insert({
            conversation_id: conversation.id,
            assigned_to: assignedTo,
            assigned_by: null,
            status: 'active',
          })

        await supabaseAdmin
          .from('assignment_logs')
          .insert({
            conversation_id: conversation.id,
            user_id: assignedTo,
            action: 'auto_assigned',
            details: 'Round-robin auto assignment',
          })
      } catch (assignErr) {
        console.warn('[webhook assignment logging warning]', assignErr)
      }
    }

    // 7. Fetch employee details if assigned
    let assignedEmployeeName = null
    let assignedEmployeePhone = null
    if (assignedTo) {
      try {
        const { data: empData } = await supabaseAdmin
          .from('users')
          .select('name, phone')
          .eq('id', assignedTo)
          .single()
        assignedEmployeeName = empData?.name || null
        assignedEmployeePhone = empData?.phone || null
      } catch (empErr) {
        console.warn('[webhook user lookup warning]', empErr)
      }
    }

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      message_id: msg.id,
      phone_number: targetPhoneNumber,
      direction,
      source,
      assigned_to: assignedTo,
      assigned_employee_name: assignedEmployeeName,
      assigned_employee_phone: assignedEmployeePhone,
    })
  } catch (err) {
    console.error('[webhook error]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
