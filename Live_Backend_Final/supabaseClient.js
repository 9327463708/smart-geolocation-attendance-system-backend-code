require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
