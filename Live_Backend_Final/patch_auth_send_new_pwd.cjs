const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

const injection = `
    // Clear OTP
    otpStore.delete(enrollmentNumber);

    const sendEmail = require('../utils/email');
    try {
      await sendEmail({
        to: user.email,
        name: user.name,
        password: newPassword
      });
    } catch (emailErr) {
      console.error('Failed to send new password email:', emailErr);
    }
`;

content = content.replace('// Clear OTP\n    otpStore.delete(enrollmentNumber);', injection);

fs.writeFileSync(file, content);
