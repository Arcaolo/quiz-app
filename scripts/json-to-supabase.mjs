import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

try {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const questions = JSON.parse(readFileSync('./questions.json', 'utf8'));

const withId = questions.filter(q => q.id != null);
const withoutId = questions.filter(q => q.id == null);

if (withId.length > 0) {
  const { error } = await supabase
    .from('questions')
    .upsert(withId, { onConflict: 'id' });
  if (error) {
    console.error('Error upserting questions:', error.message);
    process.exit(1);
  }
}

if (withoutId.length > 0) {
  const toInsert = withoutId.map(({ id, ...rest }) => rest);
  const { error } = await supabase.from('questions').insert(toInsert);
  if (error) {
    console.error('Error inserting new questions:', error.message);
    process.exit(1);
  }
}

const total = withId.length + withoutId.length;
console.log(`Synced ${total} questions to Supabase (${withoutId.length} new).`);
