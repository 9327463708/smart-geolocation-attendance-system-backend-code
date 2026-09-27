const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

const replacement = `
// Change Password - Public (Requires Old Password)
router.put('/change-password-public', async (req, res) => {
  try {
    const { enrollmentNumber, oldPassword, newPassword } = req.body;
    if (!enrollmentNumber || !oldPassword || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify old password
    const bcrypt = require('bcryptjs');
    let isMatch = false;
    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
      isMatch = await bcrypt.compare(oldPassword, user.password);
    } else {
      isMatch = (oldPassword === user.password);
    }

    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect old password' });
    }

    // Update password
    const { error: updateError } = await supabase.from('users').update({ password: newPassword }).eq('id', user.id);
    if (updateError) throw updateError;

    // Send the new password via EmailJS
    const sendEmail = require('../utils/email');
    try {
      await sendEmail({
        to: user.email,
        name: user.name,
        password: newPassword
      });
      res.json({ message: 'Password changed successfully! New password sent to your email.' });
    } catch (emailError) {
      console.error('Email Error:', emailError);
      res.status(500).json({ message: 'Password changed, but failed to send email confirmation.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
`;

content = content.replace(/\/\/ Change Password - Public.*?(?=\nmodule\.exports)/s, replacement);

fs.writeFileSync(file, content);
