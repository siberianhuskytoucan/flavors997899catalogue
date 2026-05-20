import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const coinbaseKey = process.env.COINBASE_COMMERCE_API_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const body = await req.json();
  const { cart, currency = 'BTC' } = body;
  if (!cart || !Array.isArray(cart) || cart.length === 0) return res.status(400).json({ error: 'empty cart' });
  const total = cart.reduce((s, i) => s + (i.price * (i.qty || 1)), 0).toFixed(2);
  const orderId = `order_${Date.now()}`;

  const payload = {
    name: `Order ${orderId}`,
    description: `flavors order ${orderId}`,
    local_price: { amount: total, currency: 'USD' },
    pricing_type: 'fixed_price',
    metadata: { orderId }
  };

  try {
    const resp = await fetch('https://api.commerce.coinbase.com/charges', {
      method: 'POST',
      headers: {
        'X-CC-Api-Key': coinbaseKey,
        'X-CC-Version': '2018-03-22',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(500).json({ error: 'create charge failed', detail: data });
    const charge = data.data;

    // persist order in Supabase
    await supabase.from('orders').insert([{ order_id: orderId, charge_id: charge.id, status: 'pending', total: total }]);

    return res.json({ orderId, hosted_url: charge.hosted_url, charge });
  } catch (err) {
    console.error('create-charge error', err);
    return res.status(500).json({ error: 'server error' });
  }
}
