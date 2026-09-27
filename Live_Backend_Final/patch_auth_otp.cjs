const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

// I will append the OTP routes and the store Map.
const otpRoutes = `
// Store OTPs temporarily in memory
const otpStore = new Map();

// Generate and Send OTP
router.post('/send-otp', async (req, res) => {
  try {
    const { enrollmentNumber } = req.body;
    if (!enrollmentNumber) return res.status(400).json({ message: 'Enrollment Number is required' });

    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Generate 4 digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Store with 10 mins expiry
    otpStore.set(enrollmentNumber, {
      otp,
      expires: Date.now() + 10 * 60 * 1000
    });

    const sendEmail = require('../utils/email');
    try {
      await sendEmail({
        to: user.email,
        name: user.name,
        otp: otp,
        templateId: process.env.EMAILJS_OTP_TEMPLATE_ID
      });
      res.json({ message: \`OTP sent to your email (\${user.email})\` });
    } catch (emailErr) {
      console.error(emailErr);
      res.status(500).json({ message: 'Failed to send OTP email.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Change Password via OTP
router.put('/change-password-otp', async (req, res) => {
  try {
    const { enrollmentNumber, otp, newPassword } = req.body;
    if (!enrollmentNumber || !otp || !newPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const record = otpStore.get(enrollmentNumber);
    if (!record) {
      return res.status(400).json({ message: 'No OTP requested or OTP expired' });
    }
    if (Date.now() > record.expires) {
      otpStore.delete(enrollmentNumber);
      return res.status(400).json({ message: 'OTP expired' });
    }
    if (record.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { error: updateError } = await supabase.from('users').update({ password: newPassword }).eq('id', user.id);
    if (updateError) throw updateError;

    // Clear OTP
    otpStore.delete(enrollmentNumber);

    res.json({ message: 'Password changed successfully! You can now login.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});
`;

content = content.replace(/module\.exports = router;/, otpRoutes + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
