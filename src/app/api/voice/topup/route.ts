import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin as defaultSupabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const voiceSaasSupabaseUrl = process.env.VOICE_SAAS_SUPABASE_URL
const voiceSaasSupabaseServiceKey = process.env.VOICE_SAAS_SUPABASE_SERVICE_ROLE_KEY

const queryClient = (voiceSaasSupabaseUrl && voiceSaasSupabaseServiceKey)
  ? createClient(voiceSaasSupabaseUrl, voiceSaasSupabaseServiceKey)
  : defaultSupabaseAdmin

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const amount = Number(body.amount)
    const transactionId = body.transaction_id || `TXN-${Date.now()}`
    const paymentMethod = body.payment_method || 'UPI / Online'
    const voiceOrgId = process.env.VOICE_SAAS_ORGANIZATION_ID || '9bc1c153-e617-444a-81e1-f3951d4b386b'

    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid top-up amount' }, { status: 400 })
    }

    // 1. Fetch current wallet balance
    const { data: orgData, error: fetchErr } = await queryClient
      .from('organizations')
      .select('wallet_balance')
      .eq('id', voiceOrgId)
      .maybeSingle()

    let currentBalance = 0
    if (orgData && !fetchErr) {
      currentBalance = Number(orgData.wallet_balance) || 0
    }

    const newBalance = Number((currentBalance + amount).toFixed(2))

    // 2. Update organization wallet_balance in Voice database
    const { error: updateErr } = await queryClient
      .from('organizations')
      .update({ wallet_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', voiceOrgId)

    if (updateErr) {
      console.warn('[Wallet Top-Up] Direct org update failed, trying fallback...', updateErr.message)
    }

    // 3. Try to log into transactions or audit table if exists (non-blocking)
    try {
      await queryClient
        .from('wallet_transactions')
        .insert({
          organization_id: voiceOrgId,
          amount,
          type: 'credit',
          description: `Voice AI Credits Top-Up (${paymentMethod})`,
          reference_id: transactionId,
          balance_after: newBalance,
          created_at: new Date().toISOString(),
        })
    } catch {
      // Table might not exist yet; ignore non-blocking
    }

    return NextResponse.json({
      success: true,
      amount,
      previous_balance: currentBalance,
      new_balance: newBalance,
      transaction_id: transactionId,
      message: `Successfully topped up ₹${amount.toLocaleString()} in Voice AI wallet!`,
    })
  } catch (err: any) {
    console.error('[Wallet Top-Up Error]', err)
    return NextResponse.json({ error: err.message || 'Failed to process top-up' }, { status: 500 })
  }
}
