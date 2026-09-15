const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, metadata')
    .limit(1);
    
  console.log("Data:", data, "Error:", error);
}
main();
