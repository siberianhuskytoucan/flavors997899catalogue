import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  const { orderId } = req.query;
  if (req.method !== 'GET') return res.status(405).send('Method Not Allowed');
  const { data, error } = await supabase.from('orders').select('order_id,status,total').eq('order_id', orderId).single();
  if (error || !data) return res.status(404).json({ error: 'not found' });
  return res.json({ orderId: data.order_id, status: data.status, total: data.total });
}
