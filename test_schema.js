const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .limit(1);
    
  if (lead && lead.length > 0) {
    console.log("Leads columns:", Object.keys(lead[0]));
  }
  
  const { data: conv } = await supabase
    .from('conversations')
    .select('*')
    .limit(1);
    
  if (conv && conv.length > 0) {
    console.log("Conversations columns:", Object.keys(conv[0]));
  }
}
main();
