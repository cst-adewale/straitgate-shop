const {Pool} = require('pg');

const pool = process.env.DATABASE_URL ? new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},max:5}) : null;

async function usernameAvailable(username) {
  if (!pool) throw new Error('Database is not configured.');
  const result=await pool.query('SELECT 1 FROM public.customer_profiles WHERE username=$1',[username]);
  return result.rows.length===0;
}

async function createProfile(userId, username, phone) {
  if (!pool) throw new Error('Database is not configured.');
  await pool.query('INSERT INTO public.customer_profiles (user_id,username,phone) VALUES ($1,$2,$3)',[userId,username,phone]);
}

async function getProfile(userId) {
  if (!pool) throw new Error('Database is not configured.');
  const result=await pool.query('SELECT username,phone FROM public.customer_profiles WHERE user_id=$1',[userId]);
  return result.rows[0] || null;
}

module.exports={configured:!!pool,usernameAvailable,createProfile,getProfile};
