(function () {
  const byId=id=>document.getElementById(id);
  const escape=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money=value=>'₦'+Number(value||0).toLocaleString('en-NG',{maximumFractionDigits:2});
  let wishlist=[],cart={},products=[];
  try{wishlist=JSON.parse(localStorage.getItem('straitgate-wishlist')||'[]');if(!Array.isArray(wishlist))wishlist=[]}catch(error){wishlist=[]}
  try{cart=JSON.parse(localStorage.getItem('straitgate-cart')||'{}')||{}}catch(error){cart={}}

  function updateCartCount(){byId('cartCount').textContent=Object.values(cart).reduce((sum,quantity)=>sum+(Number(quantity)||0),0)}
  function selectForCheckout(name){let selected;try{selected=JSON.parse(localStorage.getItem('straitgate-cart-selected')||'null')}catch(error){selected=null}if(!Array.isArray(selected))selected=Object.keys(cart);if(!selected.includes(name))selected.push(name);localStorage.setItem('straitgate-cart-selected',JSON.stringify(selected))}
  function render(){
    byId('wishlistCount').textContent=wishlist.length?'('+wishlist.length+')':'';
    if(!wishlist.length){byId('wishlistContent').innerHTML='<section class="empty"><h2>Your wishlist is empty</h2><p>Save products from the catalog and they’ll appear here.</p><a class="browse" href="/straitgate-catalog.html">Browse products</a></section>';return}
    const cards=wishlist.map(name=>{
      const product=products.find(item=>item.name===name);
      if(!product)return '<article class="wish-card"><div class="wish-image"><span class="placeholder" aria-hidden="true">'+escape(name.slice(0,1).toUpperCase())+'</span></div><div class="wish-info"><h2>'+escape(name)+'</h2><p>This product is no longer available.</p><button class="remove-wish" type="button" data-remove="'+escape(name)+'">Remove from wishlist</button></div></article>';
      const image=product.image?'<img src="'+escape(product.image)+'" alt="'+escape(product.name)+'" loading="lazy">':'<span class="placeholder" aria-hidden="true">'+escape(product.name.slice(0,1).toUpperCase())+'</span>';
      return '<article class="wish-card"><a class="wish-image" href="/products/'+encodeURIComponent(product.slug)+'" aria-label="View '+escape(product.name)+'">'+image+'</a><div class="wish-info"><h2>'+escape(product.name)+'</h2><p>'+escape(product.category)+'</p><p class="wish-price">'+money(product.price)+'</p><div class="wish-actions"><button class="add-cart" type="button" data-add="'+escape(product.name)+'">Add to cart</button><a class="view-product" href="/products/'+encodeURIComponent(product.slug)+'">View product</a></div><button class="remove-wish" type="button" data-remove="'+escape(product.name)+'">Remove from wishlist</button></div></article>';
    }).join('');
    byId('wishlistContent').innerHTML='<div class="wishlist-grid">'+cards+'</div><div style="margin-top:20px;text-align:right"><button class="remove-wish" type="button" data-clear>Clear wishlist</button></div>';
  }

  byId('wishlistContent').addEventListener('click',event=>{
    const remove=event.target.closest('[data-remove]');
    if(remove){wishlist=wishlist.filter(name=>name!==remove.dataset.remove);localStorage.setItem('straitgate-wishlist',JSON.stringify(wishlist));render();return}
    if(event.target.closest('[data-clear]')){wishlist=[];localStorage.setItem('straitgate-wishlist','[]');render();return}
    const add=event.target.closest('[data-add]');
    if(add){const name=add.dataset.add;cart[name]=(cart[name]||0)+1;localStorage.setItem('straitgate-cart',JSON.stringify(cart));selectForCheckout(name);updateCartCount();add.textContent='Added';setTimeout(()=>{if(add.isConnected)add.textContent='Add to cart'},1200)}
  });

  updateCartCount();
  fetch('/api/products',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Products are unavailable.');products=Array.isArray(data.products)?data.products:[];render()}).catch(()=>{render()});
})();
