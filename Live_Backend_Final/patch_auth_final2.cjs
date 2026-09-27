const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

const correctRoute = `    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
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

// Reset Password
router.put('/reset-password/:token', async (req, res) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const { data: user } = await supabase.from('users').select('*').eq('resetPasswordToken', resetPasswordToken).gt('resetPasswordExpires', Date.now()).single();

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Set new password
    const salt = await bcrypt.genSalt(10);
    const newPassword = await bcrypt.hash(req.body.password, salt);
    
    const { error: updateError } = await supabase.from('users').update({
      password: newPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null
    }).eq('id', user.id);
    
    if (updateError) throw updateError;

    res.json({ message: 'Password has been successfully reset' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
`;

const startIndex = content.indexOf(`    if (user.password`);
content = content.substring(0, startIndex) + correctRoute;

fs.writeFileSync(file, content);
