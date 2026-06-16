import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { conversation_id, assigned_to } = await req.json()

    if (!conversation_id || !assigned_to) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get current user (admin)
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let adminId = null
    if (token) {
      const { data: { user } } = await supabaseAdmin.auth.getUser(token)
      adminId = user?.id
    }

    // Update conversation
    const { error: convError } = await supabaseAdmin
      .from('conversations')
      .update({
        assigned_to,
        assignment_status: 'assigned'
      })
      .eq('id', conversation_id)

    if (convError) throw convError

    // Create assignment record
    const { error: assignError } = await supabaseAdmin
      .from('conversation_assignments')
      .insert({
        conversation_id,
        assigned_to,
        assigned_by: adminId,
        status: 'active'
      })

    if (assignError) throw assignError

    // Log the action
    await supabaseAdmin
      .from('assignment_logs')
      .insert({
        conversation_id,
        user_id: adminId || assigned_to,
        action: 'assigned',
        details: `Assigned to employee`
      })

    return NextResponse.json({ success: true })

  } catch (err) {
    console.error('[assignment]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_assignments')
      .select('*')

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (err) {
    console.error('[assignments GET]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

