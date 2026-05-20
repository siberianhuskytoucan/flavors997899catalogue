// Simple client-side shop: products, cart, and checkout helpers.
(function(){
  const PRODUCTS = [
    {id:'pfm',name:'Passion Fruit Mango Disposable',price:12.00},
    {id:'mango',name:'Mango Disposable',price:10.00},
    {id:'gb',name:'Grape Blackcurrant Disposable',price:11.50}
  ];

  function $(sel){return document.querySelector(sel)}
  function $all(sel){return Array.from(document.querySelectorAll(sel))}

  function loadProducts(){
    const container = document.getElementById('products');
    if(!container) return;
    container.innerHTML = '';
    PRODUCTS.forEach(p=>{
      const card = document.createElement('div');
      card.className = 'product-card';
      card.innerHTML = `
        <h3>${p.name}</h3>
        <div class="price">$${p.price.toFixed(2)}</div>
        <button data-id="${p.id}" class="add-btn">Add to cart</button>
      `;
      container.appendChild(card);
    });
  }

  function cartKey(){return 'flavors_cart_v1'}
  function getCart(){
    try{
      return JSON.parse(localStorage.getItem(cartKey())||'[]');
    }catch(e){return []}
  }
  function saveCart(c){ localStorage.setItem(cartKey(), JSON.stringify(c)) }
  function addToCart(id){
    const prod = PRODUCTS.find(p=>p.id===id);
    if(!prod) return;
    const cart = getCart();
    const item = cart.find(i=>i.id===id);
    if(item) item.qty += 1; else cart.push({id:prod.id,name:prod.name,price:prod.price,qty:1});
    saveCart(cart);
    updateCartCount();
  }

  function updateCartCount(){
    const countEl = document.getElementById('cart-count');
    if(!countEl) return;
    const cart = getCart();
    const total = cart.reduce((s,i)=>s+i.qty,0);
    countEl.textContent = total;
  }

  function renderCheckout(){
    const contents = document.getElementById('cart-contents');
    const totalEl = document.getElementById('order-total');
    if(!contents || !totalEl) return;
    const cart = getCart();
    if(cart.length===0){ contents.innerHTML = '<p>Your cart is empty.</p>'; totalEl.textContent=''; return; }
    const ul = document.createElement('ul');
    let total = 0;
    cart.forEach(i=>{ const li = document.createElement('li'); li.textContent = `${i.name} — ${i.qty} × $${i.price.toFixed(2)}`; ul.appendChild(li); total += i.qty * i.price; });
    contents.innerHTML = ''; contents.appendChild(ul);
    totalEl.textContent = `Total: $${total.toFixed(2)}`;
    // expose total for payment instructions
    totalEl.dataset.amount = total.toFixed(2);
  }

  // Create server-side charge (requires deployed server)
  async function createServerCharge(){
    const cart = getCart();
    try{
      const base = (window.shopConfig && window.shopConfig.backendUrl) || '';
      const url = base + '/api/create-charge';
      const resp = await fetch(url, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ cart, currency: (window.shopConfig && window.shopConfig.defaultCurrency) || 'BTC' })
      });
      const data = await resp.json();
      if(!resp.ok) throw new Error(data.error || JSON.stringify(data));
      // Open hosted checkout page
      if(data.hosted_url) window.open(data.hosted_url, '_blank');
      // Poll order status
      pollOrderStatus(data.orderId);
    }catch(err){ alert('Failed to create charge: ' + err.message); }
  }

  async function pollOrderStatus(orderId){
    const statusEl = document.getElementById('payment-status');
    if(!statusEl) return;
    statusEl.textContent = 'Waiting for payment confirmation...';
    const interval = setInterval(async ()=>{
      try{
        const base = (window.shopConfig && window.shopConfig.backendUrl) || '';
        const r = await fetch(base + `/api/order/${orderId}`);
        const j = await r.json();
        if(j.status === 'paid'){
          statusEl.textContent = 'Payment confirmed — order completed.';
          clearInterval(interval);
          // clear cart
          saveCart([]);
          updateCartCount();
        }
      }catch(e){ console.warn('poll error',e); }
    }, 5000);
  }

  function setupCheckoutInteractions(){
    const addrEl = $('#address');
    const currencyEl = $('#currency');
    const copyBtn = $('#copy-address');
    const payUri = $('#pay-uri');
    const confirmBtn = $('#confirm-paid');
    const status = $('#payment-status');

    if(!addrEl) return;
    // prefill address from config
    addrEl.value = (window.shopConfig && window.shopConfig.defaultCryptoAddress) || '';
    currencyEl.value = (window.shopConfig && window.shopConfig.defaultCurrency) || 'BTC';

    function updatePaymentURI(){
      const addr = addrEl.value.trim();
      const currency = currencyEl.value;
      const total = document.getElementById('order-total')?.dataset?.amount || '';
      // We won't compute crypto amount here; provide URI with address only.
      let uri = '#';
      if(addr){
        if(currency==='BTC') uri = `bitcoin:${addr}`;
        else if(currency==='ETH' || currency==='USDC') uri = `ethereum:${addr}`;
        else uri = addr;
      }
      payUri.href = uri;
      payUri.textContent = addr ? `Pay ${currency} to ${addr}` : 'Enter an address to get a payment URI';
    }

    addrEl.addEventListener('input', updatePaymentURI);
    currencyEl.addEventListener('change', updatePaymentURI);
    updatePaymentURI();

    copyBtn.addEventListener('click', ()=>{
      navigator.clipboard.writeText(addrEl.value.trim()).then(()=>{ status.textContent = 'Address copied to clipboard.'; setTimeout(()=>status.textContent='',3000); }).catch(()=>{ status.textContent='Copy failed'; });
    });

    confirmBtn.addEventListener('click', ()=>{
      status.textContent = 'Marked as paid (demo). Please monitor blockchain for real confirmations.';
      // In a real store you'd verify on-chain or via a payment processor.
    });

    const serverPay = document.getElementById('server-pay');
    if(serverPay){
      serverPay.addEventListener('click', (e)=>{
        e.preventDefault();
        createServerCharge();
      });
    }
  }

  // Wire up buttons on index
  function setupIndex(){
    loadProducts();
    document.addEventListener('click', (e)=>{
      const b = e.target.closest && e.target.closest('.add-btn');
      if(b){ const id = b.dataset.id; addToCart(id); }
    });
    updateCartCount();
  }

  // On DOM ready
  document.addEventListener('DOMContentLoaded', ()=>{
    setupIndex();
    renderCheckout();
    setupCheckoutInteractions();
  });

})();
