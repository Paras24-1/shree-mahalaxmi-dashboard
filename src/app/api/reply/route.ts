import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const {
      conversation_id,
      phone_number,
      message,
      media_url,
      media_type,
    } = await req.json()

    // Validate required fields
    if (!conversation_id || !phone_number) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Require either message or media
    if (!message && !media_url) {
      return NextResponse.json(
        { error: 'Either message or media_url required' },
        { status: 400 }
      )
    }

    const timestamp = new Date().toISOString()

    // 1. Save outgoing message to database
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id,
        phone_number,
        message: message || (media_type ? `[${media_type}]` : ''),
        direction: 'outgoing',
        timestamp,
        media_url: media_url || null,
        media_type: media_type || null,
      })
      .select()
      .single()

    if (msgError) throw msgError

    // 2. Update conversation
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message: message || '📸 Image',
        updated_at: timestamp,
        ai_mode: false,
      })
      .eq('id', conversation_id)

    // 3. Forward to n8n — n8n will call WhatsApp Cloud API
    const n8nWebhookUrl = process.env.N8N_REPLY_WEBHOOK_URL

    if (n8nWebhookUrl) {
      const n8nRes = await fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({
          phone_number,
          message: message || '',
          media_url: media_url || null,
          media_type: media_type || null,
          direction: 'outgoing',
          timestamp,
        }),
      })

      if (!n8nRes.ok) {
        console.warn(
          '[reply] n8n webhook call failed:',
          await n8nRes.text()
        )
        // Don't fail request because DB already saved
      }
    }

    return NextResponse.json({
      success: true,
      message_id: msg.id,
    })
  } catch (err: unknown) {
    const error =
      err instanceof Error ? err.message : 'Unknown error'

    console.error('[reply]', error)

    return NextResponse.json(
      { error },
      { status: 500 }
    )
  }
}
