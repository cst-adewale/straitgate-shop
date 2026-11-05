const {Pool} = require('pg');
const r2 = require('./r2-storage');

const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL, ssl:{rejectUnauthorized:true}, max:5}) : null;

function number(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 ? n : null; }
function stock(value) { const n = Number(value); return value !== '' && value !== null && value !== undefined && Number.isSafeInteger(n) && n >= 0 ? n : null; }
function id(value) { const n = Number(value); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function label(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }

async function publishedProducts(slug) {
  const result = await pool.query('SELECT id,slug,name,category,description,finish,operation,price_ngn,stock_quantity,image_key,image_keys,main_image_index FROM public.products WHERE published=true' + (slug ? ' AND slug=$1' : '') + ' ORDER BY created_at DESC,id DESC',slug ? [slug] : []);
  return result.rows.map(p => { const keys = p.image_keys?.length ? p.image_keys : (p.image_key ? [p.image_key] : []); return {id:Number(p.id),slug:p.slug,name:p.name,category:p.category,description:p.description,finish:p.finish,operation:p.operation,price:Number(p.price_ngn || 0),stockQuantity:p.stock_quantity === null ? null : Number(p.stock_quantity),image:keys.length ? `/api/product-image/${p.id}` : '',images:keys.map((_,i) => `/api/product-image/${p.id}/${i}`),mainImageIndex:p.main_image_index || 0}; });
}

async function list() {
  const [products, inventory, quotes] = await Promise.all([
    pool.query('SELECT id, name, category, description, finish, price_ngn, stock_quantity, image_key, image_keys, main_image_index FROM public.products ORDER BY id'),
    pool.query('SELECT id, name, item_type, sku, quantity, unit, minimum_quantity, location, unit_cost FROM public.inventory_items ORDER BY id'),
    pool.query('SELECT id, quote_number, customer_name, customer_email, customer_phone, address, items, installation_cost, discount, status, notes, valid_until, created_at FROM public.quotes ORDER BY id')
  ]);
  return {
    products:products.rows.map(p => { const keys=p.image_keys?.length ? p.image_keys : (p.image_key ? [p.image_key] : []); return {id:Number(p.id),name:p.name,cat:p.category,color:p.finish,price:Number(p.price_ngn || 0),stockQuantity:p.stock_quantity === null ? null : Number(p.stock_quantity),desc:p.description,img:keys.length ? `/api/product-image/${p.id}` : '',images:keys.map((_,i)=>`/api/product-image/${p.id}/${i}`),mainImageIndex:p.main_image_index || 0}; }),
    inv:inventory.rows.map(i => ({id:Number(i.id),name:i.name,type:i.item_type,sku:i.sku || '',qty:Number(i.quantity),unit:i.unit,min:Number(i.minimum_quantity),loc:i.location,cost:Number(i.unit_cost)})),
    quotes:quotes.rows.map(q => ({id:Number(q.id),no:q.quote_number,cust:q.customer_name,email:q.customer_email || '',phone:q.customer_phone || '',addr:q.address || '',items:q.items,inst:Number(q.installation_cost),disc:Number(q.discount),status:q.status,notes:q.notes,valid:q.valid_until ? (q.valid_until instanceof Date ? q.valid_until.toISOString() : String(q.valid_until)).slice(0,10) : '',date:q.created_at.toISOString().slice(0,10)}))
  };
}

async function mutate(kind, action, input) {
  if (action === 'add' && kind === 'products') {
    const name = label(input.name), price = number(input.price), quantity = stock(input.stockQuantity), images = input.images || (input.img ? [input.img] : []);
    const mainIndex = input.mainImageIndex === undefined ? 0 : Number(input.mainImageIndex);
    if (!name || price === null || quantity === null || !Array.isArray(images) || images.length > 5 || !Number.isInteger(mainIndex) || mainIndex < 0 || (images.length && mainIndex >= images.length) || images.some(image => typeof image !== 'string' || image.length > 300000 || !/^data:image\/jpeg;base64,[a-z0-9+/=]+$/i.test(image))) throw new TypeError('Enter a name, price, whole-number stock quantity and up to five JPEG images under 225 KB each.');
    const slug = `product-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    const imageKeys = [];
    try {
      for (const image of images) imageKeys.push(await r2.uploadJpeg(Buffer.from(image.slice('data:image/jpeg;base64,'.length),'base64')));
      await pool.query('INSERT INTO public.products (slug,name,category,description,finish,operation,price_ngn,image_key,image_keys,main_image_index,stock_quantity,published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)',[slug,name,label(input.cat,80),label(input.desc,500),label(input.color,80),label(input.operation,80),price,imageKeys[mainIndex] || '',imageKeys,mainIndex,quantity]);
    } catch (error) {
      await Promise.all(imageKeys.map(key => r2.remove(key).catch(() => {})));
      throw error;
    }
  } else if (action === 'setStock' && kind === 'products') {
    const productId=id(input.id), quantity=stock(input.stockQuantity);
    if (!productId || quantity === null) throw new TypeError('Enter a valid whole-number stock quantity.');
    const changed=await pool.query('UPDATE public.products SET stock_quantity=$2 WHERE id=$1 RETURNING id',[productId,quantity]);
    if (!changed.rows.length) throw new TypeError('Product not found.');
  } else if (action === 'mainImage' && kind === 'products') {
    const productId=id(input.id), index=Number(input.index);
    if (!productId || !Number.isInteger(index) || index < 0 || index > 4) throw new TypeError('Choose a valid product image.');
    const changed=await pool.query('UPDATE public.products SET main_image_index=$2,image_key=image_keys[$2+1] WHERE id=$1 AND $2 < cardinality(image_keys) RETURNING id',[productId,index]);
    if (!changed.rows.length) throw new TypeError('Product image not found.');
  } else if (action === 'add' && kind === 'inventory') {
    const name = label(input.name), qty = number(input.qty), min = number(input.min), cost = number(input.cost);
    if (!name || qty === null || min === null || cost === null) throw new TypeError('Enter a name and valid non-negative numbers.');
    await pool.query('INSERT INTO public.inventory_items (name,item_type,sku,quantity,unit,minimum_quantity,location,unit_cost) VALUES ($1,$2,NULLIF($3,\'\'),$4,$5,$6,$7,$8)',[name,label(input.type,80),label(input.sku,80),qty,label(input.unit,20) || 'pcs',min,label(input.loc,120),cost]);
  } else if (action === 'add' && kind === 'quotes') {
    const customer = label(input.cust), items = input.items;
    if (!customer || !Array.isArray(items) || !items.length || items.length > 50 || items.some(i => !label(i.d) || number(i.q) === null || Number(i.q) <= 0 || number(i.p) === null)) throw new TypeError('Enter a customer and valid quote items.');
    const inst = number(input.inst), disc = number(input.disc);
    if (inst === null || disc === null || disc > 100 || (input.valid && !/^\d{4}-\d{2}-\d{2}$/.test(input.valid))) throw new TypeError('Enter valid installation, discount and date values.');
    const numberValue = `Q-${Date.now()}`;
    await pool.query('INSERT INTO public.quotes (quote_number,customer_name,customer_email,customer_phone,address,items,installation_cost,discount,status,notes,valid_until) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,\'Draft\',$9,$10)',[numberValue,customer,label(input.email,254),label(input.phone,60),label(input.addr,300),JSON.stringify(items.map(i => ({d:label(i.d),q:Number(i.q),p:Number(i.p)}))),inst,disc,label(input.notes,2000),input.valid || null]);
  } else if (action === 'remove' && ['products','inventory','quotes'].includes(kind)) {
    const table = {products:'products',inventory:'inventory_items',quotes:'quotes'}[kind];
    if (!id(input.id)) throw new TypeError('Invalid item ID.');
    const removed = await pool.query(`DELETE FROM public.${table} WHERE id=$1 RETURNING ${kind === 'products' ? 'image_key,image_keys' : 'id'}`,[input.id]);
    if (kind === 'products' && removed.rows[0]) for (const key of new Set([removed.rows[0].image_key,...(removed.rows[0].image_keys || [])].filter(Boolean))) await r2.remove(key).catch(error => console.error('R2 cleanup failed:', error.message));
  } else if (action === 'adjust' && kind === 'inventory') {
    if (!id(input.id) || ![-1,1].includes(input.delta)) throw new TypeError('Invalid stock change.');
    await pool.query('UPDATE public.inventory_items SET quantity=GREATEST(0,quantity+$1) WHERE id=$2',[input.delta,input.id]);
  } else if (action === 'status' && kind === 'quotes') {
    if (!id(input.id) || !['Draft','Sent','Accepted','Declined'].includes(input.status)) throw new TypeError('Invalid quote status.');
    await pool.query('UPDATE public.quotes SET status=$1 WHERE id=$2',[input.status,input.id]);
  } else throw new TypeError('Unsupported action.');
}

async function productImage(productId, imageIndex) {
  if (!id(productId)) return null;
  const result = await pool.query('SELECT image_key,image_keys,main_image_index FROM public.products WHERE id=$1 AND published=true',[productId]);
  const row=result.rows[0]; if (!row) return null;
  const keys=row.image_keys?.length ? row.image_keys : (row.image_key ? [row.image_key] : []);
  const index=imageIndex === undefined ? row.main_image_index || 0 : Number(imageIndex);
  return Number.isInteger(index) && keys[index] ? r2.getJpeg(keys[index]) : null;
}

async function checkDatabase() {
  if (!pool) return {ok:false,latencyMs:null};
  const started=performance.now();
  try { await pool.query('SELECT 1'); return {ok:true,latencyMs:Math.round(performance.now()-started)}; }
  catch (error) { console.error('Database health check failed:',error.code || error.message); return {ok:false,latencyMs:null}; }
}

module.exports = {configured:!!pool, list, mutate, productImage, publishedProducts, checkDatabase};
