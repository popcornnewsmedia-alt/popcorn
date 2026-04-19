import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data, error } = await supabase
  .from('articles')
  .select('*')
  .eq('id', 682);

if (error) { console.error(error); process.exit(1); }
data.forEach(a => {
  console.log(`\n[${a.id}] ${a.title}`);
  Object.entries(a).forEach(([k, v]) => {
    const s = v == null ? '' : String(v);
    if (s && s.length < 500) console.log(`  ${k}: ${s}`);
  });
});
