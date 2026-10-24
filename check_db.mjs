import { createClient } from '@supabase/supabase-js';

const url = 'https://btcflofvakenqaoybvwy.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Y2Zsb2Z2YWtlbnFhb3lidnd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1NDg0MTAsImV4cCI6MjEwODEyNDQxMH0.5NibkT7fry0PohnnnWrmEJHxTnsYCJD2Hu3fWRkG2R4';

const supabase = createClient(url, key);

async function main() {
  // Intentar un insert fallido controlado o select para ver qué columnas existen
  const { data: vi, error: viErr } = await supabase.from('venta_items').select('*').limit(1);
  console.log('venta_items:', vi, 'error:', viErr);

  const { data: mi, error: miErr } = await supabase.from('movimientos_inventario').select('*').limit(1);
  console.log('movimientos_inventario:', mi, 'error:', miErr);

  const { data: v, error: vErr } = await supabase.from('ventas').select('*').limit(1);
  console.log('ventas:', v, 'error:', vErr);
}

main();
