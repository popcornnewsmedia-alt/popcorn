import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const updates = [
  {
    id: 679,
    title: "A Mother Doesn't Know Her Son Died — She's Been Talking to an AI Version of Him",
    summary: "A grieving mother has been having regular conversations with an AI version of her son, not knowing he has actually died. Her family chose to hide his death from her and let her believe the AI replica is him. The story is raising urgent questions about what AI grief technology is actually doing to people.",
  },
  {
    id: 685,
    title: "Trump Signs Executive Order Fast-Tracking Psychedelics for PTSD After a Text From Joe Rogan",
  },
  {
    id: 689,
    title: "Charlize Theron on Timothée Chalamet: 'AI Is Going to Be Able to Do His Job in 10 Years'",
  },
];

for (const u of updates) {
  const patch = { title: u.title };
  if (u.summary) patch.summary = u.summary;
  const { error } = await supabase.from('articles').update(patch).eq('id', u.id);
  if (error) console.error(`x id=${u.id}:`, error.message);
  else       console.log(`ok id=${u.id} -> "${u.title.slice(0, 80)}"`);
}
