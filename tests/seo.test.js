const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {productPage,sitemap} = require('../seo');

const origin = 'https://straitgate.onrender.com';
const product = {id:7,slug:'test-gate',name:'Gate <Strong>',category:'Garden gate',description:'A secure & durable gate',price:125000,stockQuantity:2,image:'/api/product-image/7'};
const template = fs.readFileSync(path.join(__dirname,'../public/straitgate-product.html'),'utf8');
const page = productPage(template,product,origin);
assert.match(page,/<title>Gate &lt;Strong&gt; \| Garden gate \| Straitgate<\/title>/);
assert.match(page,/<link rel="canonical" href="https:\/\/straitgate.onrender.com\/products\/test-gate">/);
assert.match(page,/<h1 id="name">Gate &lt;Strong&gt;<\/h1>/);
assert.match(page,/<meta property="og:image" content="https:\/\/straitgate.onrender.com\/api\/product-image\/7">/);
assert.match(page,/<script type="application\/ld\+json">/);
assert.ok(!page.includes('<h1 id="name">Gate <Strong>'));
assert.ok(sitemap(origin,[product]).includes('<loc>https://straitgate.onrender.com/products/test-gate</loc>'));
assert.ok(!sitemap(origin,[product]).includes('straitgate-product.html'));
console.log('Product SEO metadata and sitemap pass');
