require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

const ORDERS_FILE = path.join(__dirname,'orders.json');
function loadOrders(){
  try{ return JSON.parse(fs.readFileSync(ORDERS_FILE,'utf8')||'[]') }catch(e){ return []; }
}
function saveOrders(o){ fs.writeFileSync(ORDERS_FILE, JSON.stringify(o,null,2)) }

app.use(cors());
app.use(express.json());

// Create a charge via Coinbase Commerce
app.post('/api/create-charge', async (req,res)=>{
  const {cart,currency='BTC'} = req.body;
  if(!cart || !Array.isArray(cart) || cart.length===0) return res.status(400).json({error:'empty cart'});
  const total = cart.reduce((s,i)=>s + (i.price * (i.qty||1)),0).toFixed(2);

  const orderId = `order_${Date.now()}`;
  const payload = {
    name: `Order ${orderId}`,
    description: `flavors order ${orderId}`,
    local_price: { amount: total, currency: 'USD' },
    pricing_type: 'fixed_price',
    metadata: { orderId }
  };

  try{
    const resp = await axios.post('https://api.commerce.coinbase.com/charges', payload, {
      headers: {
        'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY || '',
        'X-CC-Version': '2018-03-22',
        'Content-Type': 'application/json'
      }
    });
    const charge = resp.data && resp.data.data;
    const orders = loadOrders();
    orders.push({ orderId, cart, total, status: 'pending', chargeId: charge.id });
    saveOrders(orders);
    return res.json({ orderId, hosted_url: charge.hosted_url, charge });
  }catch(err){
    console.error('create-charge error',err?.response?.data || err.message);
    return res.status(500).json({ error: 'charge creation failed', detail: err?.response?.data || err.message });
  }
});

// Get order status
app.get('/api/order/:orderId', (req,res)=>{
  const orders = loadOrders();
  const o = orders.find(x=>x.orderId===req.params.orderId);
  if(!o) return res.status(404).json({error:'not found'});
  return res.json({ orderId: o.orderId, status: o.status, total: o.total });
});

// Webhook endpoint for Coinbase Commerce
app.post('/api/webhook', express.raw({ type: 'application/json' }), (req,res)=>{
  const sig = req.headers['x-cc-webhook-signature'] || '';
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SHARED_SECRET || '';
  const computed = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
  if(!sig || !secret || !crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(sig))){
    console.warn('webhook signature invalid');
    return res.status(400).send('invalid signature');
  }

  let event;
  try{ event = JSON.parse(req.body.toString()); }catch(e){ return res.status(400).send('bad payload'); }
  const type = event.type;
  const charge = event.data;
  // Example event types: charge:confirmed, charge:failed
  if(type && charge && charge.metadata && charge.metadata.orderId){
    const orderId = charge.metadata.orderId;
    const orders = loadOrders();
    const o = orders.find(x=>x.orderId===orderId);
    if(o){
      if(type === 'charge:confirmed' || type === 'charge:resolved'){
        o.status = 'paid';
      }else if(type === 'charge:failed'){
        o.status = 'failed';
      }
      saveOrders(orders);
    }
  }
  res.json({received:true});
});

app.listen(PORT, ()=>{
  if(!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');
  console.log(`Crypto server listening on http://localhost:${PORT}`);
});
