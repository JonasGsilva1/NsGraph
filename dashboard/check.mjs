import { config } from 'dotenv';
import { createClient } from "@supabase/supabase-js";

config({ path: '.env' });
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('companies').select('*');
  console.log("DATA:");
  console.log(data);
  console.log("ERROR:");
  console.log(error);
}
check();
