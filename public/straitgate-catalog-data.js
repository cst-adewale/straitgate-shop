(function () {
  const grid = document.querySelector('.catalog-area .grid');
  const count = document.getElementById('resultCount');
  const state = {products:[],category:'',finish:'',operation:'',search:'',min:0,max:Infinity,sort:'featured',cart:JSON.parse(localStorage.getItem('straitgate-cart') || '{}'),wishlist:JSON.parse(localStorage.getItem('straitgate-wishlist') || '[]')};
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG');
  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const adMessages = ['Made-to-measure doors built for your home','Custom gates made in Lagos','Nationwide delivery on shop orders'];
  const adMessage = document.getElementById('shopAdMessage');
  let adIndex = 0;
  if (adMessage) setInterval(() => {
    if (document.hidden) return;
    adMessage.classList.add('changing');
    setTimeout(() => { adIndex = (adIndex + 1) % adMessages.length; adMessage.textContent = adMessages[adIndex]; adMessage.classList.remove('changing'); }, 200);
  }, 5000);
  const save = () => {localStorage.setItem('straitgate-cart',JSON.stringify(state.cart));localStorage.setItem('straitgate-wishlist',JSON.stringify(state.wishlist))};
  const toast = message => {document.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;document.body.append(el);setTimeout(()=>el.remove(),2200)};
  const updateCart = () => {document.getElementById('cartCount').textContent=Object.values(state.cart).reduce((a,b)=>a+b,0)};

  function card(product) {
    const el = document.createElement('article');
    el.tabIndex = 0;
    el.dataset.id = product.id;
    const stockText = product.stockQuantity === null ? 'Availability pending' : product.stockQuantity <= 3 ? product.stockQuantity+' '+(product.stockQuantity === 1 ? 'unit' : 'units')+' remaining' : 'In stock';
    el.innerHTML = '<div class="tile">'+(product.image ? '<img src="'+escape(product.image)+'" alt="'+escape(product.name)+'" loading="lazy" decoding="async">' : '<span class="product-placeholder">'+escape(product.name.slice(0,1))+'</span>')+'</div><div class="row"><span>'+escape(product.name)+'</span><span>'+money(product.price)+'</span></div><p class="sub">'+escape(product.description || product.category)+'</p><p class="stock-status">'+stockText+'</p><div class="card-actions"><button class="add-cart" type="button">Add to cart</button><button class="wishlist" type="button" aria-label="Save product">'+(state.wishlist.includes(product.name)?'♥':'♡')+'</button></div>';
    el.querySelector('.wishlist').classList.toggle('active',state.wishlist.includes(product.name));
    el.addEventListener('click',event => {
      if (event.target.closest('.add-cart')) {state.cart[product.name]=(state.cart[product.name]||0)+1;save();updateCart();toast(product.name+' added to cart')}
      else if (event.target.closest('.wishlist')) {state.wishlist=state.wishlist.includes(product.name)?state.wishlist.filter(x=>x!==product.name):[...state.wishlist,product.name];save();render();toast('Wishlist updated')}
      else location.href='/products/'+encodeURIComponent(product.slug);
    });
    el.addEventListener('keydown',event => {if ((event.key==='Enter'||event.key===' ') && event.target===el) {event.preventDefault();location.href='/products/'+encodeURIComponent(product.slug)}});
    return el;
  }

  function render() {
    let products=state.products.filter(p => {
      const text=(p.name+' '+p.category+' '+p.description+' '+p.finish+' '+p.operation).toLowerCase();
      return (!state.category||p.category.toLowerCase()===state.category)&&(!state.finish||p.finish.toLowerCase()===state.finish)&&(!state.operation||p.operation.toLowerCase()===state.operation)&&(!state.search||text.includes(state.search))&&p.price>=state.min&&p.price<=state.max;
    });
    if(state.sort==='name')products.sort((a,b)=>a.name.localeCompare(b.name));
    if(state.sort==='category')products.sort((a,b)=>a.category.localeCompare(b.category));
    grid.replaceChildren(...products.map(card));
    if(!products.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent=state.products.length?'No products match these filters.':'No products have been added yet.';grid.append(empty)}
    count.textContent='Showing '+products.length+' products';
    document.getElementById('activeFilters').textContent=[state.category,state.finish,state.operation,state.search&&'Search: '+state.search].filter(Boolean).join(' · ');
  }

  function filters() {
    const panel=document.querySelector('.sidebar .panel');
    const sections=panel.querySelectorAll('.filter');
    const categories=[...new Set(state.products.map(p=>p.category).filter(Boolean))];
    const finishes=[...new Set(state.products.map(p=>p.finish).filter(Boolean))];
    const operations=[...new Set(state.products.map(p=>p.operation).filter(Boolean))];
    const categoryHtml=categories.map(x=>'<label><span>'+escape(x)+'</span><input type="checkbox" value="'+escape(x.toLowerCase())+'"></label>').join('');
    sections[0].innerHTML='<h3>Category</h3>'+categoryHtml;
    sections[2].innerHTML='<h3>Finish</h3>'+finishes.map(x=>'<label><span>'+escape(x)+'</span><input type="checkbox" value="'+escape(x.toLowerCase())+'"></label>').join('');
    sections[3].innerHTML='<h3>Operation</h3>'+operations.map(x=>'<label><span>'+escape(x)+'</span><input type="checkbox" value="'+escape(x.toLowerCase())+'"></label>').join('');
    [['category',sections[0]],['finish',sections[2]],['operation',sections[3]]].forEach(([key,section])=>section.addEventListener('change',event=>{section.querySelectorAll('input').forEach(input=>{if(input!==event.target)input.checked=false});state[key]=event.target.checked?event.target.value:'';render()}));
    const chips=document.querySelector('.chips');
    chips.innerHTML='<button class="chip" data-category="" aria-pressed="true">All</button>'+categories.map(x=>'<button class="chip" data-category="'+escape(x.toLowerCase())+'" aria-pressed="false">'+escape(x)+'</button>').join('');
    chips.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;state.category=button.dataset.category;chips.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));sections[0].querySelectorAll('input').forEach(x=>x.checked=x.value===state.category);render()});
    const arrivals=document.querySelectorAll('.sidebar .panel')[1];
    arrivals.innerHTML='<h2>New arrivals</h2>'+state.products.slice(0,3).map(p=>'<a class="best-item" href="/products/'+encodeURIComponent(p.slug)+'"><span class="best-thumb">'+(p.image?'<img src="'+escape(p.image)+'" alt="" loading="lazy" decoding="async">':'')+'</span><span><b>'+escape(p.name)+'</b><span>'+escape(p.category)+'</span></span></a>').join('');
  }

  function renderWishlist() {
    document.querySelector('.drawer-shade')?.remove();
    const shade=document.createElement('div');shade.className='drawer-shade';
    const entries=state.wishlist.map(name=>({name,product:state.products.find(p=>p.name===name)}));
    shade.innerHTML='<aside class="cart-drawer" aria-label="Saved products"><div class="drawer-head"><div><small>YOUR SAVED ITEMS</small><h2>Saved products</h2></div><button class="close-drawer" aria-label="Close saved products">×</button></div><div class="cart-lines">'+(entries.length?entries.map(({name,product})=>'<div class="cart-line"><div>'+(product?'<a href="/products/'+encodeURIComponent(product.slug)+'"><b>'+escape(name)+'</b></a>':'<b>'+escape(name)+'</b><small>This product is no longer available.</small>')+'</div><button class="remove-cart" type="button" data-wishlist-remove="'+escape(name)+'">Remove</button></div>').join(''):'<p style="padding:40px 0;color:var(--mute)">You have no saved products yet.</p>')+'</div></aside>';
    document.body.append(shade);
    shade.addEventListener('click',event=>{if(event.target===shade||event.target.closest('.close-drawer')){shade.remove();return}const remove=event.target.closest('[data-wishlist-remove]');if(remove){state.wishlist=state.wishlist.filter(name=>name!==remove.dataset.wishlistRemove);save();renderWishlist()}});
  }

  function categoryMatch(key, category) {
    const value=category.toLowerCase();
    if(key==='security-doors') return value.includes('door')&&!value.includes('pedestrian');
    if(key==='sliding-gates') return value.includes('sliding');
    if(key==='pedestrian-gates') return value.includes('pedestrian');
    if(key==='estate-gates') return value.includes('estate');
    return false;
  }

  document.addEventListener('click',event=>{
    const link=event.target.closest('[data-shop-category]');
    if(link){
      event.preventDefault();
      const key=link.dataset.shopCategory;
      const product=state.products.find(item=>categoryMatch(key,item.category));
      state.category=key==='all'?'':product?product.category.toLowerCase():key;
      document.querySelectorAll('.chips .chip').forEach(chip=>chip.setAttribute('aria-pressed',String(chip.dataset.category===state.category)));
      document.querySelectorAll('.sidebar .filter:first-of-type input').forEach(input=>input.checked=input.value===state.category);
      document.querySelector('.category-nav')?.classList.remove('open');
      document.getElementById('menuToggle')?.setAttribute('aria-expanded','false');
      render();document.getElementById('catalog').scrollIntoView({behavior:'smooth'});return;
    }
    if(event.target.closest('[data-open-wishlist]')){event.preventDefault();renderWishlist();return}
  });

  grid.replaceChildren();count.textContent='Loading products…';
  document.querySelector('.pagination').hidden=true;document.getElementById('moreButton').hidden=true;
  document.getElementById('menuToggle').onclick=function(){const nav=document.querySelector('.category-nav'),open=nav.classList.toggle('open');this.setAttribute('aria-expanded',open);this.setAttribute('aria-label',open?'Close menu':'Open menu')};
  document.querySelector('.search').addEventListener('submit',event=>{event.preventDefault();state.search=event.currentTarget.querySelector('input').value.trim().toLowerCase();render()});
  document.getElementById('sortSelect').onchange=event=>{state.sort=event.target.value;render()};
  document.getElementById('gridView').onclick=()=>{grid.classList.remove('list-view');document.getElementById('gridView').classList.add('active');document.getElementById('listView').classList.remove('active')};
  document.getElementById('listView').onclick=()=>{grid.classList.add('list-view');document.getElementById('listView').classList.add('active');document.getElementById('gridView').classList.remove('active')};
  document.querySelector('.mobile-filter-button').onclick=()=>document.querySelector('.sidebar').classList.add('mobile-sidebar-open');
  document.querySelector('.mobile-sidebar-close').onclick=()=>document.querySelector('.sidebar').classList.remove('mobile-sidebar-open');
  document.querySelectorAll('.price-fields input').forEach(input=>input.onchange=()=>{const fields=document.querySelectorAll('.price-fields input');state.min=Number(fields[0].value)||0;state.max=Number(fields[1].value)||Infinity;render()});
  document.querySelector('.sign button').onclick=()=>toast('Newsletter sign-up is not available yet');
  updateCart();
  fetch('/api/products').then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Products unavailable');state.products=data.products;filters();render()}).catch(error=>{grid.replaceChildren();const box=document.createElement('div');box.className='empty-state';box.textContent=error.message;grid.append(box);count.textContent='Products unavailable'});
})();
