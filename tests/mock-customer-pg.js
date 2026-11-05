const pgPath=require.resolve('pg');
const profiles=new Map();
require.cache[pgPath]={id:pgPath,filename:pgPath,loaded:true,exports:{Pool:class {
  async query(sql,values=[]){
    if(sql.startsWith('SELECT 1 FROM public.customer_profiles'))return {rows:profiles.has(values[0])?[{exists:1}]:[]};
    if(sql.startsWith('INSERT INTO public.customer_profiles')){profiles.set(values[1],{user_id:values[0],username:values[1],phone:values[2]});return {rows:[]};}
    if(sql.startsWith('SELECT username,phone FROM public.customer_profiles'))return {rows:[...profiles.values()].filter(p=>p.user_id===values[0]).map(({username,phone})=>({username,phone}))};
    return {rows:[]};
  }
}}};
