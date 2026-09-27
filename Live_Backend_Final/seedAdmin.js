const supabase = require('./supabaseClient');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  const { data, error } = await supabase.from('users').select('*').eq('role', 'superadmin');
  if (data && data.length > 0) {
    console.log("Admin already exists!");
    return;
  }
  
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('admin123', salt);

  const { data: insertData, error: insertError } = await supabase.from('users').insert({
    name: 'Super Admin',
    enrollmentNumber: 'admin',
    email: 'admin@college.com',
    password: password,
    role: 'superadmin'
  });

  if (insertError) {
    console.error("Error creating admin:", insertError);
  } else {
    console.log("Admin user seeded successfully! Login: admin / admin123");
  }
}

seedAdmin();
