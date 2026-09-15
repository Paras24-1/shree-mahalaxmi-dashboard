import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: org } = await supabase.from('organizations').select('id, name, slug').eq('slug', 'osmo-ro-2').single();
  console.log('Org:', org);
  if (!org) return;

  const { data: users } = await supabase.from('users').select('id, name, email').eq('org_id', org.id);
  console.log('Users:', users);
}
run();
