(function () {
  const byId = id => document.getElementById(id);
  const escape = value => String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = value => '₦' + Number(value || 0).toLocaleString('en-NG', {maximumFractionDigits:2});
  let cart = {};
  let products = [];
  try { cart = JSON.parse(localStorage.getItem('straitgate-cart') || '{}') || {}; } catch (error) { cart = {}; }

  function save() {
    localStorage.setItem('straitgate-cart', JSON.stringify(cart));
    const count = Object.values(cart).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);
    byId('cartCount').textContent = count;
    byId('cartTitleCount').textContent = count ? '(' + count + (count === 1 ? ' item' : ' items') + ')' : '';
  }

  function render() {
    const entries = Object.entries(cart).filter(([, quantity]) => Number(quantity) > 0);
    if (!entries.length) {
      byId('cartContent').innerHTML = '<section class="cart-items cart-empty"><h2>Your cart is empty</h2><p>Browse the catalog and add a product to get started.</p><a class="empty-link" href="/straitgate-catalog.html">Browse products</a></section>';
      save();
      return;
    }
    let subtotal = 0;
    const rows = entries.map(([name, quantity]) => {
      const product = products.find(item => item.name === name);
      const price = product ? Number(product.price) || 0 : null;
      if (price !== null) subtotal += price * Number(quantity);
      const image = product?.image ? '<img src="' + escape(product.image) + '" alt="' + escape(name) + '" loading="lazy">' : '<span class="item-placeholder" aria-hidden="true">' + escape(name.slice(0,1).toUpperCase()) + '</span>';
      return '<article class="cart-item"><a class="item-image" href="' + (product ? '/products/' + encodeURIComponent(product.slug) : '/straitgate-catalog.html') + '" aria-label="View ' + escape(name) + '">' + image + '</a><div><h2 class="item-name">' + escape(name) + '</h2><p class="item-category">' + escape(product?.category || 'Shop product') + '</p><p class="item-unit">' + (price === null ? 'Price unavailable' : money(price) + ' each') + '</p><div class="item-tools"><div class="quantity" aria-label="Quantity for ' + escape(name) + '"><button type="button" data-quantity="minus" data-name="' + escape(name) + '" aria-label="Decrease ' + escape(name) + ' quantity">−</button><span>' + Number(quantity) + '</span><button type="button" data-quantity="plus" data-name="' + escape(name) + '" aria-label="Increase ' + escape(name) + ' quantity">+</button></div><button class="remove-item" type="button" data-remove="' + escape(name) + '">Remove</button></div></div><div class="line-price">' + (price === null ? '—' : money(price * Number(quantity))) + '</div></article>';
    }).join('');
    byId('cartContent').innerHTML = '<div class="cart-layout"><section class="cart-items" aria-label="Items in your cart"><div class="cart-list-head"><strong>' + entries.length + (entries.length === 1 ? ' product' : ' products') + '</strong><button class="remove-item" type="button" data-clear>Clear cart</button></div>' + rows + '</section><aside class="summary" aria-label="Order summary"><h2>Order summary</h2><div class="summary-row"><span>Subtotal</span><strong>' + money(subtotal) + '</strong></div><div class="summary-row muted"><span>Delivery</span><span>Confirmed separately</span></div><div class="summary-row total"><span>Total</span><strong>' + money(subtotal) + '</strong></div><p class="checkout-note">Your cart is saved in this browser. Online payment checkout is not available yet; confirm delivery and payment with the shop before ordering.</p><a class="continue-link" href="/straitgate-catalog.html">Continue shopping</a></aside></div>';
    save();
  }

  byId('cartContent').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-clear')) cart = {};
    else if (button.hasAttribute('data-remove')) delete cart[button.dataset.remove];
    else if (button.dataset.quantity) {
      const name = button.dataset.name;
      cart[name] = Math.max(1, Number(cart[name]) + (button.dataset.quantity === 'plus' ? 1 : -1));
    } else return;
    localStorage.setItem('straitgate-cart', JSON.stringify(cart));
    render();
  });

  save();
  render();
  fetch('/api/products', {cache:'no-store'}).then(async response => {
    const data = await response.json();
    if (!response.ok) throw Error(data.error || 'Product details are unavailable.');
    products = Array.isArray(data.products) ? data.products : [];
    render();
  }).catch(() => {});
})();
