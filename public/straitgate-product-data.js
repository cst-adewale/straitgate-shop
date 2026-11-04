(function () {
  const byId = id => document.getElementById(id);
  let products = [],current = null,quantity = 1;
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cart = JSON.parse(localStorage.getItem('straitgate-cart') || '{}');
  function cartCount(){byId('bagn').textContent=Object.values(cart).reduce((a,b)=>a+b,0)}
  function image(product){return product.image?'<img src="'+escape(product.image)+'" alt="'+escape(product.name)+'">':'<span class="product-placeholder">'+escape(product.name.slice(0,1))+'</span>'}
  function render() {
    const id=Number(location.hash.replace('#product-',''));
    current=products.find(p=>p.id===id) || (!location.hash ? products[0] : null);
    if(!current){byId('name').textContent=products.length?'Product not found':'No products have been added yet.';byId('desc').textContent='Browse the catalog for available products.';byId('main').replaceChildren();byId('rel').replaceChildren();byId('add').disabled=true;return}
    byId('add').disabled=false;
    document.title='Straitgate – '+current.name;
    byId('bc').textContent=current.name;byId('cat').textContent=current.category;byId('name').textContent=current.name;
    byId('price').textContent=money(current.price);byId('desc').textContent=current.description || current.category;
    byId('cn').textContent=current.finish || 'Not specified';byId('cols').replaceChildren();
    byId('sn').textContent='Made to measure';byId('sizes').replaceChildren();
    byId('g').textContent=current.operation || 'Discuss during consultation';
    byId('main').innerHTML=image(current);byId('main').setAttribute('aria-label',current.name);
    byId('thumbs').innerHTML=current.image?'<button type="button" aria-label="Main image" aria-pressed="true">'+image(current)+'</button>':'';
    byId('spec').innerHTML=[['Category',current.category],['Finish',current.finish||'To be selected'],['Operation',current.operation||'To be confirmed'],['Configuration','Made to measure']].map(([name,value])=>'<div>'+escape(name)+'<span>'+escape(value)+'</span></div>').join('');
    byId('rel').innerHTML=products.filter(p=>p.id!==current.id).slice(0,3).map(p=>'<a href="#product-'+p.id+'"><div class="tile">'+image(p)+'</div><div class="r"><span>'+escape(p.name)+'</span><span>'+money(p.price)+'</span></div><p>'+escape(p.category)+'</p></a>').join('');
  }
  byId('menuToggle').onclick=function(){const open=document.querySelector('nav').classList.toggle('open');this.setAttribute('aria-expanded',open);this.setAttribute('aria-label',open?'Close menu':'Open menu')};
  byId('m').onclick=()=>{quantity=Math.max(1,quantity-1);byId('q').textContent=quantity};
  byId('p').onclick=()=>{quantity=Math.min(9,quantity+1);byId('q').textContent=quantity};
  byId('add').onclick=()=>{if(!current)return;cart[current.name]=(cart[current.name]||0)+quantity;localStorage.setItem('straitgate-cart',JSON.stringify(cart));cartCount();const toast=byId('toast');toast.textContent=quantity+' × '+current.name+' added to cart';toast.classList.add('on');setTimeout(()=>toast.classList.remove('on'),2200)};
  window.addEventListener('hashchange',()=>{quantity=1;byId('q').textContent=1;render();window.scrollTo(0,0)});
  cartCount();byId('name').textContent='Loading product…';
  fetch('/api/products').then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Products unavailable');products=data.products;render()}).catch(error=>{byId('name').textContent='Product unavailable';byId('desc').textContent=error.message;byId('add').disabled=true});
})();
