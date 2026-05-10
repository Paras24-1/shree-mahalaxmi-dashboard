import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getNextEmployee(): Promise<string | null> {
  // Get all employees
  const { data: employees } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('role', 'employee')
    .order('created_at', { ascending: true })

  if (!employees || employees.length === 0) return null

  // Count how many conversations each employee has assigned
  const counts = await Promise.all(
    employees.map(async (emp) => {
      const { count } = await supabaseAdmin
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', emp.id)
      return { id: emp.id, count: count ?? 0 }
    })
  )

  // Assign to employee with least conversations (round-robin effect)
  counts.sort((a, b) => a.count - b.count)
  return counts[0].id
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { phone_number, message, direction, name, media_url, media_type } = body

    if (!phone_number || !direction) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const contactName = name || phone_number
    const timestamp   = new Date()
    const msgText     = message || (media_type ? `[${media_type}]` : '')

    // 1. Check if conversation already exists
    const { data: existing } = await supabaseAdmin
      .from('conversations')
      .select('id, assigned_to')
      .eq('phone_number', phone_number)
      .single()

    // 2. Get next employee only for NEW conversations
    let assignedTo = existing?.assigned_to || null
if (direction === 'incoming' && !assignedTo) {
  assignedTo = await getNextEmployee()
}

    // 3. Upsert conversation with assignment
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('conversations')
      .upsert(
        {
          phone_number,
          name: contactName,
          last_message: msgText,
          ...(direction === 'incoming' ? { updated_at: new Date().toISOString() } : {}),
          ...(assignedTo ? { assigned_to: assignedTo, assignment_status: 'assigned' } : {})
        },
        { onConflict: 'phone_number' }
      )
      .select()
      .single()

    if (convError) throw convError

    // 4. Insert message
    const { data: msg, error: msgError } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversation.id,
        phone_number,
        message: msgText,
        direction,
        timestamp: timestamp.toISOString(),
        media_url:  media_url  || null,
        media_type: media_type || null,
      })
      .select()
      .single()

    if (msgError) throw msgError

    // 5. Upsert lead
    await supabaseAdmin
      .from('leads')
      .upsert(
        { conversation_id: conversation.id, phone_number, name: contactName },
        { onConflict: 'conversation_id' }
      )

    // 6. Log assignment if new conversation was assigned
    if (!existing && assignedTo) {
      await supabaseAdmin
        .from('conversation_assignments')
        .insert({
          conversation_id: conversation.id,
          assigned_to: assignedTo,
          assigned_by: null,
          status: 'active'
        })

      await supabaseAdmin
        .from('assignment_logs')
        .insert({
          conversation_id: conversation.id,
          user_id: assignedTo,
          action: 'auto_assigned',
          details: 'Round-robin auto assignment'
        })
    }

    return NextResponse.json({ 
      success: true, 
      conversation_id: conversation.id, 
      message_id: msg.id,
      assigned_to: assignedTo
    })

  } catch (err) {
    console.error('[webhook]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
