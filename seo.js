function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

function productUrl(origin, product) {
  return `${origin}/products/${encodeURIComponent(product.slug)}`;
}

function productPage(template, product, origin) {
  const url = productUrl(origin, product);
  const title = `${product.name} | ${product.category} | Straitgate`;
  const description = String(product.description || `Explore ${product.name}, a made-to-measure ${product.category} from Straitgate.`).trim().slice(0, 160);
  const imageUrl = product.image ? origin + product.image : '';
  const schema = {'@context':'https://schema.org','@type':'Product',name:product.name,description,image:imageUrl || undefined,sku:product.slug,brand:{'@type':'Brand',name:'Straitgate'},offers:{'@type':'Offer',url,priceCurrency:'NGN',price:product.price,availability:product.stockQuantity === 0 ? 'https://schema.org/OutOfStock' : product.stockQuantity === null ? undefined : 'https://schema.org/InStock'}};
  return template
    .replace(/<title>[^<]*<\/title>/, `<title>${html(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${html(description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="index,follow">')
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${html(url)}">`)
    .replace(/<meta property="og:type"[^\n]*/, `<meta property="og:type" content="product"><meta property="og:title" content="${html(title)}"><meta property="og:description" content="${html(description)}"><meta property="og:url" content="${html(url)}"><meta property="og:site_name" content="Straitgate">${imageUrl ? `<meta property="og:image" content="${html(imageUrl)}">` : ''}`)
    .replace(/<meta name="twitter:card"[^\n]*/, `<meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}"><meta name="twitter:title" content="${html(title)}"><meta name="twitter:description" content="${html(description)}">`)
    .replace('</head>', `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script>\n</head>`)
    .replace('<h1 id="name"></h1>', `<h1 id="name">${html(product.name)}</h1>`)
    .replace('<p class="price" id="price"></p>', `<p class="price" id="price">₦${Number(product.price).toLocaleString('en-NG')}</p>`)
    .replace('<p class="desc" id="desc"></p>', `<p class="desc" id="desc">${html(description)}</p>`)
    .replace('<div class="tile main-t" id="main" role="img"></div>', `<div class="tile main-t" id="main" role="img" aria-label="${html(product.name)}">${imageUrl ? `<img src="${html(product.image)}" alt="${html(product.name)}" loading="eager">` : ''}</div>`);
}

function sitemap(origin, products) {
  const urls = [`${origin}/straitgate-home.html`,`${origin}/straitgate-catalog.html`,...products.map(p => productUrl(origin,p))];
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(url => `  <url><loc>${html(url)}</loc></url>`).join('\n') + '\n</urlset>\n';
}

module.exports = {productPage, sitemap};
