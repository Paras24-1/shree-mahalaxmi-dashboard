const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: org, error: orgError } = await supabase.from('organizations').select('id, name').eq('slug', 'osmo-ro-2').single();
  if (orgError) {
    console.error('Org error:', orgError);
    return;
  }
  console.log('Org ID:', org.id);

  const { data: users, error: usersError } = await supabase.from('users').select('id, name, email').eq('org_id', org.id);
  if (usersError) {
    console.error('Users error:', usersError);
    return;
  }
  
  console.log('Users:');
  users.forEach(u => console.log(`- ${u.name} / ${u.email}: ${u.id}`));
}

run();
