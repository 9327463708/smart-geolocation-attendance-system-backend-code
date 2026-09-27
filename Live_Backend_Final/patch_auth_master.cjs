const fs = require('fs');
const file = 'C:/Users/HP/Downloads/Temple Management/college-attendance-system/backend/routes/auth.js';
let content = fs.readFileSync(file, 'utf8');

// I will just supply the correct content for the entire auth.js file because it's the safest way.
const fullContent = `const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabase = require('../supabaseClient');

const router = express.Router();

// Register a new student
router.post('/register', async (req, res) => {
  try {
    const { enrollmentNumber, email, password, photoBase64 } = req.body;

    const { data: isAllowed } = await supabase.from('allowed_enrollments').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    if (!isAllowed) {
      return res.status(403).json({ message: 'Your enrollment number is not authorized by the Admin.' });
    }

    const { data: existingUser } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    if (existingUser) {
      return res.status(400).json({ message: 'User with this enrollment number already exists.' });
    }

    if (!photoBase64) {
      return res.status(400).json({ message: 'Passport size photo is required.' });
    }

    const { error: insertError } = await supabase.from('users').insert({
      name: isAllowed.fullName,
      enrollmentNumber,
      email,
      branch: isAllowed.branch,
      password: password,
      photo: photoBase64,
      role: 'student'
    });

    if (insertError) {
      throw insertError;
    }
    
    // Mark enrollment as registered
    await supabase.from('allowed_enrollments').update({ isRegistered: true }).eq('id', isAllowed.id);
    
    res.status(201).json({ message: 'User registered successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Register a new Faculty using 10-digit code
router.post('/register-faculty', async (req, res) => {
  try {
    const { code } = req.body;

    const { data: facultyCode } = await supabase.from('faculty_codes').select('*').eq('code', code).single();
    if (!facultyCode) return res.status(400).json({ message: 'Invalid 10-digit code' });
    if (facultyCode.isUsed) return res.status(400).json({ message: 'This code has already been used' });

    const { data: existingUser } = await supabase.from('users').select('*').eq('enrollmentNumber', code).single();
    if (existingUser) return res.status(400).json({ message: 'Faculty already registered with this code' });

    const salt = await bcrypt.genSalt(10);
    const dummyPassword = await bcrypt.hash('faculty_dummy_pass', salt);

    const { error: insertError } = await supabase.from('users').insert({
      name: facultyCode.facultyName,
      enrollmentNumber: code, // using code as their login ID
      email: \`\${code}@faculty.com\`, // dummy email
      password: dummyPassword, // dummy password
      role: 'faculty',
      subjectName: facultyCode.subjectName,
      subjectCode: facultyCode.subjectCode
    });

    if (insertError) throw insertError;
    
    // Mark code as used
    await supabase.from('faculty_codes').update({ isUsed: true }).eq('id', facultyCode.id);

    res.json({ message: 'Faculty registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { enrollmentNumber, password, isFacultyLogin } = req.body;

    let { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    
    // Auto-register faculty if code is valid but user doesn't exist yet
    if (!user && isFacultyLogin) {
      const { data: facultyCode } = await supabase.from('faculty_codes').select('*').eq('code', enrollmentNumber).single();
      if (facultyCode && !facultyCode.isUsed) {
        const salt = await bcrypt.genSalt(10);
        const dummyPassword = await bcrypt.hash('faculty_dummy_pass', salt);
        
        const { data: newUser, error: insertError } = await supabase.from('users').insert({
          name: facultyCode.facultyName,
          enrollmentNumber: enrollmentNumber,
          email: enrollmentNumber + '@faculty.com',
          password: dummyPassword,
          role: 'faculty',
          subjectName: facultyCode.subjectName,
          subjectCode: facultyCode.subjectCode
        }).select().single();
        
        if (!insertError) {
          await supabase.from('faculty_codes').update({ isUsed: true }).eq('id', facultyCode.id);
          user = newUser;
        }
      }
    }

    if (!user) {
      return res.status(400).json({ message: 'Invalid Credentials' });
    }

    // If it's a faculty logging in with only their code
    if (isFacultyLogin && user.role === 'faculty') {
      // No password check needed
    } else {
      let isMatch = false;
      if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
        isMatch = await bcrypt.compare(password, user.password);
      } else {
        isMatch = (password === user.password);
      }
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid Credentials' });
      }
    }

    const payload = {
      user: {
        id: user.id,
        role: user.role
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'secret123',
      { expiresIn: '1d' },
      (err, token) => {
        if (err) throw err;
        res.json({ token, user: { name: user.name, enrollmentNumber: user.enrollmentNumber, role: user.role, subject: user.subjectName, branch: user.branch, semester: user.semester, photo: user.photo } });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Forgot Password / Reset Password - Email actual password
router.post('/forgot-password', async (req, res) => {
  try {
    const { enrollmentNumber, newPassword } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();

    if (!user) {
      return res.status(404).json({ message: 'User with this Enrollment Number not found' });
    }

    if (user.password && (user.password.startsWith('$2a$') || user.password.startsWith('$2b$'))) {
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

fs.writeFileSync(file, fullContent);
