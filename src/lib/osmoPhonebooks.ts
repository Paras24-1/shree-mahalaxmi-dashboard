import { supabaseAdmin } from '@/lib/supabase'

export type OsmoCategoryKey = 'osmo_dealer' | 'dealer' | 'customer' | 'unfiltered'

export const OSMO_PHONEBOOK_DEFINITIONS: Record<OsmoCategoryKey, { name: string; label: string; description: string }> = {
  osmo_dealer: {
    name: 'Osmo Dealers',
    label: 'Osmo Dealers',
    description: 'Auto-segregated authorized Osmo RO dealers & distributors'
  },
  dealer: {
    name: 'Dealers',
    label: 'Dealers',
    description: 'Auto-segregated general RO dealers, retailers, traders & technicians'
  },
  customer: {
    name: 'Customers',
    label: 'Customers',
    description: 'Auto-segregated inbound customer leads, buyers & residential inquiries'
  },
  unfiltered: {
    name: 'Unfiltered Leads',
    label: 'Unfiltered',
    description: 'Auto-segregated undefined leads pending role identification'
  }
}

export function cleanPhone(raw: any): string {
  if (!raw) return ''
  let cleaned = String(raw).replace(/\D/g, '')
  if (cleaned.length === 10 && /^[6789]/.test(cleaned)) {
    cleaned = '91' + cleaned
  }
  return cleaned
}

const OSMO_DEALER_FAST_KEYS = new Set(['osmo_dealer', 'osmo dealer', 'osmo_deler'])
const DEALER_FAST_KEYS = new Set(['dealer', 'deler', 'distributor', 'retailer'])
const CUSTOMER_FAST_KEYS = new Set(['customer', 'consumer', 'client', 'end_user'])

const DEALER_KEYWORDS = [
  'dealer', 'deler', 'delar', 'dealers', 'dealership', 'distributor', 'distributer', 'distributorship',
  'wholesaler', 'wholesale', 'retailer', 'reseller', 'technician', 'mechanic', 'fitter',
  'trader', 'traders', 'trading', 'enterprise', 'enterprises', 'agency', 'agencies',
  'ro care', 'aqua care', 'water solution', 'water solutions', 'water tech', 'water purifier shop',
  'spare parts', 'spares', 'bulk order', 'dealer price', 'dealer rate', 'wholesale price', 'wholesale rate',
  'visiting card', 'business card', 'gstin', 'b2b', 'dukaan', 'shop name', 'outlet'
]

const CUSTOMER_KEYWORDS = [
  'customer', 'consumer', 'client', 'end user', 'enduser', 'buyer', 'direct buyer',
  'residential', 'domestic', 'household',
  'ghar ke liye', 'ghar k liye', 'ghar me', 'ghar pe', 'home use', 'for home', 'for house', 'for kitchen', 'personal use', 'flat',
  'installation', 'fitting', 'service', 'repair', 'filter change', 'membrane change', 'water purifier buy', 'buy ro',
  'lagwana hai', 'kharidna hai', 'ro chahiye', 'purifier chahiye', 'price of ro', 'ro price', 'kitne ka hai', 'rate kya hai'
]

export function classifyOsmoContact(item: any): OsmoCategoryKey {
  if (!item) return 'unfiltered'

  // Fast check directly on item.lead_type
  if (item.lead_type) {
    const lt = String(item.lead_type).trim().toLowerCase()
    if (OSMO_DEALER_FAST_KEYS.has(lt)) return 'osmo_dealer'
    if (DEALER_FAST_KEYS.has(lt)) return 'dealer'
    if (CUSTOMER_FAST_KEYS.has(lt)) return 'customer'
    if (lt === 'unfiltered') return 'unfiltered'
  }

  const leadObj = item.lead ? (Array.isArray(item.lead) ? item.lead[0] : item.lead) : item
  const leadMeta = typeof leadObj?.metadata === 'string'
    ? (() => { try { return JSON.parse(leadObj.metadata) } catch { return {} } })()
    : (leadObj?.metadata || {})

  const convMeta = typeof item.metadata === 'string'
    ? (() => { try { return JSON.parse(item.metadata) } catch { return {} } })()
    : (item.metadata || {})

  // 0. Explicit Manual Override Check First (Highest Priority)
  const explicitType = (
    item.lead_type ||
    item.Lead_Type ||
    convMeta.lead_type ||
    convMeta.Lead_Type ||
    convMeta.category ||
    convMeta.user_type ||
    leadObj?.lead_type ||
    leadObj?.Lead_Type ||
    leadMeta?.lead_type ||
    leadMeta?.Lead_Type ||
    leadMeta?.category ||
    leadMeta?.user_type
  )?.toString().trim().toLowerCase()

  if (explicitType) {
    if (OSMO_DEALER_FAST_KEYS.has(explicitType)) return 'osmo_dealer'
    if (DEALER_FAST_KEYS.has(explicitType)) return 'dealer'
    if (CUSTOMER_FAST_KEYS.has(explicitType)) return 'customer'
    if (explicitType === 'unfiltered') return 'unfiltered'
  }

  const typeFields = [
    item.lead_type,
    item.Lead_Type,
    convMeta.lead_type,
    convMeta.Lead_Type,
    convMeta.type,
    convMeta.user_type,
    convMeta.customer_type,
    convMeta.category,
    convMeta.role,
    convMeta.business_type,
    leadObj?.lead_type,
    leadObj?.Lead_Type,
    leadMeta?.lead_type,
    leadMeta?.Lead_Type,
    leadMeta?.type,
    leadMeta?.user_type,
    leadMeta?.customer_type,
    leadMeta?.category,
    leadMeta?.role,
    leadMeta?.business_type,
  ].filter(Boolean).map(v => String(v).trim().toLowerCase())

  const nameFields = [
    item.name,
    item.customer_name,
    leadObj?.name,
    leadObj?.customer_name,
    leadMeta?.name,
    leadMeta?.contact_person,
    leadMeta?.dealer_name,
    leadMeta?.business_name,
    leadMeta?.shop_name,
    leadMeta?.company,
  ].filter(Boolean).map(v => String(v).trim().toLowerCase())

  const notesAndMessages = [
    item.notes,
    item.last_message,
    leadObj?.notes,
    leadObj?.followup_notes,
    leadObj?.machine_interest,
    leadMeta?.notes,
    leadMeta?.followup_notes,
    leadMeta?.remarks,
    leadMeta?.tags,
    leadMeta?.conversation_summary,
    leadMeta?.machine_interest,
    leadMeta?.city,
    convMeta?.notes,
    convMeta?.last_message,
    convMeta?.summary,
  ].filter(Boolean).map(v => String(v).trim().toLowerCase())

  const allText = [
    ...typeFields,
    ...nameFields,
    ...notesAndMessages,
    ...Object.values(leadMeta).filter(v => typeof v === 'string').map(v => String(v).toLowerCase()),
    ...Object.values(convMeta).filter(v => typeof v === 'string').map(v => String(v).toLowerCase())
  ].join(' ')

  // 1. Osmo Dealer match (Authorized Osmo Dealers & Distributors)
  const isOsmoDealer = 
    typeFields.some(t => t.includes('osmo') && (t.includes('deal') || t.includes('deler') || t.includes('distribut') || t.includes('partner') || t.includes('retail') || t.includes('franchis'))) ||
    allText.includes('osmo dealer') ||
    allText.includes('osmodealer') ||
    allText.includes('osmo deler') ||
    allText.includes('osmo distributor') ||
    allText.includes('osmo partner') ||
    (allText.includes('osmo') && (allText.includes('dealer') || allText.includes('deler') || allText.includes('distributor') || allText.includes('dealership')))

  if (isOsmoDealer) return 'osmo_dealer'

  // 2. Dealer / Retailer / Technician / B2B match
  const isDealer =
    typeFields.some(t => DEALER_KEYWORDS.some(k => t.includes(k))) ||
    nameFields.some(n => DEALER_KEYWORDS.some(k => n.includes(k))) ||
    notesAndMessages.some(m => DEALER_KEYWORDS.some(k => m.includes(k))) ||
    DEALER_KEYWORDS.some(k => allText.includes(k))

  if (isDealer) return 'dealer'

  // 3. Customer of RO (Domestic/Residential/Inbound Buyer/Service inquiries)
  const isCustomer =
    typeFields.some(t => CUSTOMER_KEYWORDS.some(k => t.includes(k))) ||
    nameFields.some(n => CUSTOMER_KEYWORDS.some(k => n.includes(k))) ||
    notesAndMessages.some(m => CUSTOMER_KEYWORDS.some(k => m.includes(k))) ||
    CUSTOMER_KEYWORDS.some(k => allText.includes(k))

  if (isCustomer) return 'customer'

  // 4. Default fallback: undefined leads that did not define what they are
  return 'unfiltered'
}

export async function isOsmoOrg(orgId: string): Promise<boolean> {
  try {
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('name, slug')
      .eq('id', orgId)
      .maybeSingle()

    if (org?.name?.toLowerCase().includes('osmo') || org?.slug?.toLowerCase().includes('osmo')) {
      return true
    }

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('org_id', orgId)

    return (users || []).some(u => u.email?.toLowerCase() === 'paanifilter9@gmail.com')
  } catch {
    return false
  }
}

/**
 * Ensures the 3 auto-segregated phonebooks exist for Osmo RO,
 * synchronizes all current conversations & CRM leads into their respective phonebooks,
 * and returns the phonebook records with updated live contact counts.
 */
export async function syncOsmoPhonebooks(orgId: string) {
  try {
    // 1. Ensure the 3 phonebook records exist in DB
    const { data: existingPhonebooks, error: pbFetchErr } = await supabaseAdmin
      .from('phonebooks')
      .select('*')
      .eq('org_id', orgId)

    if (pbFetchErr) throw pbFetchErr

    const pbMap: Record<OsmoCategoryKey, any> = {
      osmo_dealer: null,
      dealer: null,
      customer: null,
      unfiltered: null
    }

    for (const [key, def] of Object.entries(OSMO_PHONEBOOK_DEFINITIONS) as [OsmoCategoryKey, any][]) {
      let found = (existingPhonebooks || []).find((p: any) => 
        p.name.toLowerCase() === def.name.toLowerCase() ||
        p.name.toLowerCase() === `[auto] ${def.name}`.toLowerCase() ||
        p.name.toLowerCase() === `osmo ro - ${def.name}`.toLowerCase()
      )

      if (!found) {
        const { data: createdPb, error: createErr } = await supabaseAdmin
          .from('phonebooks')
          .insert({
            org_id: orgId,
            name: def.name
          })
          .select()
          .single()

        if (createErr) {
          console.error(`Error creating auto phonebook ${def.name}:`, createErr)
        } else {
          found = createdPb
        }
      }

      pbMap[key] = found
    }

    // 2. Fetch all conversations and leads for this org with pagination
    let conversations: any[] = []
    let fromConv = 0
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id, phone_number, name, stage, last_message, notes')
        .eq('org_id', orgId)
        .range(fromConv, fromConv + 999)
      if (error) break
      if (!data || data.length === 0) break
      conversations.push(...data)
      if (data.length < 1000) break
      fromConv += 1000
    }

    let leads: any[] = []
    let fromLead = 0
    while (true) {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('org_id', orgId)
        .range(fromLead, fromLead + 999)
      if (error) break
      if (!data || data.length === 0) break
      leads.push(...data)
      if (data.length < 1000) break
      fromLead += 1000
    }

    // Map leads by conversation id and phone
    const leadsByConvId = new Map<string, any>()
    const leadsByPhone = new Map<string, any>()
    leads.forEach(l => {
      if (l.conversation_id) leadsByConvId.set(l.conversation_id, l)
      const p = (l.phone_number || '').replace(/\D/g, '').slice(-10)
      if (p) leadsByPhone.set(p, l)
    })

    // Group contacts by category
    const categorizedContacts: Record<OsmoCategoryKey, Map<string, any>> = {
      osmo_dealer: new Map(),
      dealer: new Map(),
      customer: new Map(),
      unfiltered: new Map()
    };

    // Process conversations
    (conversations || []).forEach((c: any) => {
      const p = cleanPhone(c.phone_number)
      if (p.length < 10) return

      const rawPhone = (c.phone_number || '').replace(/\D/g, '').slice(-10)
      const leadObj = (c.id ? leadsByConvId.get(c.id) : null) || (rawPhone ? leadsByPhone.get(rawPhone) : null)
      const category = classifyOsmoContact({ ...c, lead: leadObj })
      const meta = typeof c.metadata === 'string' ? (() => { try { return JSON.parse(c.metadata) } catch { return {} } })() : (c.metadata || {})
      const leadMeta = typeof leadObj?.metadata === 'string' ? (() => { try { return JSON.parse(leadObj.metadata) } catch { return {} } })() : (leadObj?.metadata || {})

      const name = c.name || leadObj?.name || leadObj?.customer_name || meta.name || leadMeta.name || leadMeta.contact_person || `Contact ${p.slice(-4)}`
      const stage = c.stage || leadObj?.stage || 'new'
      const quality = leadObj?.lead_quality || leadObj?.lead_temperature || meta.lead_quality || 'cold'
      const score = leadObj?.lead_score || meta.lead_score || 0
      const city = leadMeta.city || meta.city || ''
      const machineInterest = leadMeta.machine_interest || meta.machine_interest || ''
      const has_been_bulk_messaged = leadMeta.has_been_bulk_messaged || meta.has_been_bulk_messaged || false;

      categorizedContacts[category].set(p, {
        phone: p,
        name,
        variables: {
          name,
          phone: p,
          category: OSMO_PHONEBOOK_DEFINITIONS[category].label,
          stage,
          quality: String(quality).toUpperCase(),
          score: String(score),
          city,
          machine_interest: machineInterest,
          has_been_bulk_messaged: String(has_been_bulk_messaged)
        }
      })
    });

    // Process leads (in case any lead exists without a conversation record)
    (leads || []).forEach((l: any) => {
      const p = cleanPhone(l.phone_number)
      if (p.length < 10) return

      // If already added via conversations, preserve existing or merge
      const category = classifyOsmoContact(l)
      if (!categorizedContacts[category].has(p)) {
        const meta = typeof l.metadata === 'string' ? (() => { try { return JSON.parse(l.metadata) } catch { return {} } })() : (l.metadata || {})
        const name = l.name || (l as any).customer_name || meta.name || meta.contact_person || `Lead ${p.slice(-4)}`
        const stage = l.stage || 'new'
        const quality = l.lead_quality || l.lead_temperature || meta.lead_quality || 'cold'
        const score = l.lead_score || meta.lead_score || 0
        const city = meta.city || ''
        const machineInterest = meta.machine_interest || ''
        const has_been_bulk_messaged = meta.has_been_bulk_messaged || false;

        categorizedContacts[category].set(p, {
          phone: p,
          name,
          variables: {
            name,
            phone: p,
            category: OSMO_PHONEBOOK_DEFINITIONS[category].label,
            stage,
            quality: String(quality).toUpperCase(),
            score: String(score),
            city,
            machine_interest: machineInterest,
            has_been_bulk_messaged: String(has_been_bulk_messaged)
          }
        })
      }
    })

    // 3. Upsert contacts for each of the 3 phonebooks
    for (const [key, pb] of Object.entries(pbMap) as [OsmoCategoryKey, any][]) {
      if (!pb?.id) continue

      const contactsList = Array.from(categorizedContacts[key].values())
      
      // Delete existing contacts for this phonebook to refresh cleanly
      await supabaseAdmin
        .from('phonebook_contacts')
        .delete()
        .eq('phonebook_id', pb.id)

      if (contactsList.length > 0) {
        const rows = contactsList.map(c => ({
          phonebook_id: pb.id,
          phone: c.phone,
          name: c.name,
          variables: c.variables
        }))

        // Insert in chunks of 500
        for (let i = 0; i < rows.length; i += 500) {
          const chunk = rows.slice(i, i + 500)
          await supabaseAdmin
            .from('phonebook_contacts')
            .insert(chunk)
        }
      }
    }

    return { success: true }
  } catch (err) {
    console.error('[syncOsmoPhonebooks] error:', err)
    return { success: false, error: err }
  }
}
