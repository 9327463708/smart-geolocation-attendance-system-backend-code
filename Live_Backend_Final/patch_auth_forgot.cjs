const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

// We will replace the current forgot-password route
const newForgotRoute = `
// Forgot Password / Reset Password - Email actual password
router.post('/forgot-password', async (req, res) => {
  try {
    const { enrollmentNumber, newPassword } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();

    if (!user) {
      return res.status(404).json({ message: 'User with this Enrollment Number not found' });
    }

    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      return res.status(400).json({ message: 'Your account uses an old encrypted password. Please contact Admin to reset it.' });
    }

    let passwordToSend = user.password;

    // If a new password is provided, update it in the database
    if (newPassword && newPassword.trim() !== '') {
      const { error: updateError } = await supabase.from('users').update({ password: newPassword }).eq('id', user.id);
      if (updateError) throw updateError;
      passwordToSend = newPassword;
    }

    // Send email with the password
    const sendEmail = require('../utils/email');
    
    try {
      await sendEmail({
        to: user.email,
        name: user.name,
        password: passwordToSend
      });
      
      res.json({ message: \`Password has been sent to your email (\${user.email}).\` });
    } catch (emailError) {
      console.error('Email Error:', emailError);
      res.status(500).json({ message: 'Could not send email. Make sure Admin has configured the email settings.' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
`;

content = content.replace(/\/\/ Forgot Password - Email actual password[\s\S]*?(?=\/\/ Change Password - Public)/, newForgotRoute);

fs.writeFileSync(file, content);
