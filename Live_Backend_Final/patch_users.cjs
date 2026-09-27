const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/users.js';
let content = fs.readFileSync(file, 'utf8');

const route = `
// Change Password
router.put('/change-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    const { data: user } = await supabase.from('users').select('password').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Check old password
    const bcrypt = require('bcryptjs');
    let isMatch = false;
    if (user.password.startsWith('$2')) {
      isMatch = await bcrypt.compare(oldPassword, user.password);
    } else {
      isMatch = (oldPassword === user.password);
    }
    
    if (!isMatch) return res.status(400).json({ message: 'Incorrect old password' });
    
    const { error } = await supabase.from('users').update({ password: newPassword }).eq('id', req.user.id);
    if (error) throw error;
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});
`;

content = content.replace(/module\.exports = router;/, route + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
