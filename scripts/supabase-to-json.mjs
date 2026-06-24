import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

try {
  const { config } = await import('dotenv');
  config({ path: '.env.local' });
} catch {}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const { data, error } = await supabase
  .from('questions')
  .select('id, text, options, correct_answer')
  .order('id', { ascending: true });

if (error) {
  console.error('Error fetching questions:', error.message);
  process.exit(1);
}

const newJson = JSON.stringify(data, null, 2) + '\n';

let existingJson = '';
try {
  existingJson = readFileSync('./questions.json', 'utf8');
} catch {}

if (newJson === existingJson) {
  console.log('No changes — questions.json is already up to date.');
  process.exit(0);
}

writeFileSync('./questions.json', newJson);
console.log(`Updated questions.json with ${data.length} questions.`);
