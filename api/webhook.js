import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export const config = {
  api: {
    bodyParser: false,
  },
};

function bufferToString(buf) {
  return buf.toString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const sig = req.headers['x-cc-webhook-signature'] || '';
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SHARED_SECRET || '';
  const buf = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const payload = bufferToString(buf);
  const computed = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!sig || !secret || !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))) {
    console.warn('webhook signature invalid');
    return res.status(400).send('invalid signature');
  }
  let event;
  try { event = JSON.parse(payload); } catch (e) { return res.status(400).send('bad payload'); }
  const type = event.type;
  const charge = event.data;
  if (type && charge && charge.metadata && charge.metadata.orderId) {
    const orderId = charge.metadata.orderId;
    if (type === 'charge:confirmed' || type === 'charge:resolved') {
      await supabase.from('orders').update({ status: 'paid' }).eq('order_id', orderId);
    } else if (type === 'charge:failed') {
      await supabase.from('orders').update({ status: 'failed' }).eq('order_id', orderId);
    }
  }
  res.json({ received: true });
}
