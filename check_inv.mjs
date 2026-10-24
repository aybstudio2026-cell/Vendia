import { createClient } from '@supabase/supabase-js';

const url = 'https://btcflofvakenqaoybvwy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Y2Zsb2Z2YWtlbnFhb3lidnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NDg0MTAsImV4cCI6MjEwODEyNDQxMH0.5NibkT7fry0PohnnnWrmEJHxTnsYCJD2Hu3fWRkG2R4';

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase.from('inventario').select('*').limit(1);
  console.log('inventario select *:', data, 'Error:', error);
}

main();
