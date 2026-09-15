import { supabaseAdmin } from './supabase'

const STATE_MAPPING: Record<string, string> = {
  'm.p': 'Sneha',
  'madhya pradesh': 'Sneha',
  'chattisgarh': 'Sneha',
  'chhattisgarh': 'Sneha',

  'goa': 'Nikita',
  'andhra pradesh': 'Nikita',
  'adhra pradesh': 'Nikita',
  'assam': 'Nikita',
  'telangana': 'Nikita',
  'tilagana': 'Nikita',

  'rajasthan': 'Gulista',

  'bihar': 'Kamal',
  'bengal': 'Kamal',
  'west bengal': 'Kamal',
  'jharkhand': 'Kamal',

  'ghaziabad': 'Amit',
  'noida': 'Amit',

  'kerala': 'Azad',
  'karnataka': 'Azad',
  'karnatka': 'Azad',
  'orrisa': 'Azad',
  'odisha': 'Azad',

  'gujrat': 'Gulvir',
  'gujarat': 'Gulvir',
  'maharastra': 'Gulvir',
  'maharashtra': 'Gulvir',

  'j.k': 'Ritu',
  'jammu': 'Ritu',
  'kashmir': 'Ritu',
  'punjab': 'Ritu',
  'himachal pradesh': 'Ritu',
  'haryana': 'Ritu',

  'u.p': 'Deepti',
  'uttar pradesh': 'Deepti',

  'delhi': 'Dinesh'
}

export async function handlePaanifilterStateAssignment(orgId: string, conversationId: string, state: string) {
  if (!state || !conversationId) return;

  const cleanState = state.toLowerCase().trim();
  let targetEmployeeName = null;

  for (const [key, name] of Object.entries(STATE_MAPPING)) {
    if (cleanState.includes(key)) {
      targetEmployeeName = name;
      break;
    }
  }

  if (!targetEmployeeName) return;

  // Find the user ID of the employee
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, name')
    .eq('org_id', orgId)
    .ilike('name', `%${targetEmployeeName}%`)
    .limit(1)
    .maybeSingle();

  if (users?.id) {
    // Check if it's already assigned
    const { data: conv } = await supabaseAdmin
      .from('conversations')
      .select('assigned_to')
      .eq('id', conversationId)
      .maybeSingle();
      
    if (conv && !conv.assigned_to) {
      // Assign it
      await supabaseAdmin
        .from('conversations')
        .update({ assigned_to: users.id, assignment_status: 'assigned' })
        .eq('id', conversationId);

      await supabaseAdmin
        .from('conversation_assignments')
        .insert({
          conversation_id: conversationId,
          org_id: orgId,
          assigned_to: users.id,
          status: 'active'
        });

      await supabaseAdmin
        .from('assignment_logs')
        .insert({
          conversation_id: conversationId,
          org_id: orgId,
          user_id: users.id,
          action: 'auto_assigned',
          details: `State-based assignment (${state})`
        });
        
      console.log(`[Paanifilter] Assigned conversation ${conversationId} to ${targetEmployeeName} (${users.id}) for state: ${state}`);
    }
  }
}
