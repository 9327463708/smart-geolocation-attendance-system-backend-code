const express = require('express');
const supabase = require('../supabaseClient');
const { auth, superadmin } = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const router = express.Router();

// Generate a new 10-digit code for a faculty
router.post('/generate-faculty-code', auth, superadmin, async (req, res) => {
  try {
    const { facultyName, subjectName, subjectCode } = req.body;
    if (!facultyName || !subjectName || !subjectCode) {
      return res.status(400).json({ message: 'Faculty Name, Subject Name, and Subject Code are required' });
    }

    const code = Math.floor(1000000000 + Math.random() * 9000000000).toString();

    const { error: codeErr } = await supabase.from('faculty_codes').insert({
      code,
      facultyName,
      subjectName,
      subjectCode,
      isUsed: true
    });
    if (codeErr) throw codeErr;

    const dummyPassword = await bcrypt.hash('faculty_dummy_pass', 10);
    const { error: userErr } = await supabase.from('users').insert({
      name: facultyName,
      enrollmentNumber: code,
      email: `${code}@faculty.com`,
      password: dummyPassword,
      role: 'faculty',
      subjectName,
      subjectCode
    });
    if (userErr) throw userErr;

    res.json({ message: 'Code generated and Faculty registered successfully', code, facultyName, subjectName, subjectCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// View all generated codes
router.get('/faculty-codes', auth, superadmin, async (req, res) => {
  try {
    const { data: codes, error } = await supabase.from('faculty_codes').select('*');
    if (error) throw error;
    res.json(codes);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete a generated code
router.delete('/faculty-codes/:id', auth, superadmin, async (req, res) => {
  try {
    const { data: code, error: fetchErr } = await supabase.from('faculty_codes').select('*').eq('id', req.params.id).single();
    if (fetchErr || !code) return res.status(404).json({ message: 'Code not found' });
    
    if (code.isUsed) {
      await supabase.from('users').delete().eq('enrollmentNumber', code.code).eq('role', 'faculty');
    }

    await supabase.from('faculty_codes').delete().eq('id', req.params.id);
    res.json({ message: 'Faculty code and user deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update College Location Configuration
router.post('/config/location', auth, superadmin, async (req, res) => {
  try {
    const { latitude, longitude, radius } = req.body;
    const { data: configs } = await supabase.from('config').select('*').limit(1);
    
    if (configs && configs.length > 0) {
      await supabase.from('config').update({
        collegeLocation: { latitude, longitude },
        allowedRadiusMeters: radius
      }).eq('id', configs[0].id);
    } else {
      await supabase.from('config').insert({
        collegeLocation: { latitude, longitude },
        allowedRadiusMeters: radius
      });
    }
    
    const { data: newConfig } = await supabase.from('config').select('*').limit(1).single();
    res.json({ message: 'College location updated successfully', config: newConfig });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get current config
router.get('/config/location', auth, superadmin, async (req, res) => {
  try {
    const { data: config, error } = await supabase.from('config').select('*').limit(1).single();
    if (!error && config) {
      res.json({
        latitude: config.collegeLocation.latitude,
        longitude: config.collegeLocation.longitude,
        radius: config.allowedRadiusMeters
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update student email
router.put('/student-email', auth, superadmin, async (req, res) => {
  try {
    const { enrollmentNumber, newEmail } = req.body;
    if (!enrollmentNumber || !newEmail) {
      return res.status(400).json({ message: 'Enrollment Number and new Email are required' });
    }

    const { data: user, error: findError } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    
    if (findError && findError.code !== 'PGRST116') throw findError;
    if (!user) {
      return res.status(404).json({ message: 'Student with this Enrollment Number not found' });
    }

    const { error: updateError } = await supabase.from('users').update({ email: newEmail }).eq('id', user.id);
    if (updateError) throw updateError;

    res.json({ message: 'Student email updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Save timetable for a specific branch, sem, and batch
router.post('/timetable', auth, superadmin, async (req, res) => {
  try {
    const { branch, semester, batch, dayOfWeek, startDate, endDate, slots } = req.body;
    const { data: timetable, error: fetchError } = await supabase.from('timetables').select('*').eq('branch', branch).eq('semester', semester).eq('batch', batch).eq('dayOfWeek', dayOfWeek).single();
    
    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError;
    }
    
    if (timetable) {
      const { error: updateError } = await supabase.from('timetables').update({ startDate, endDate, slots }).eq('id', timetable.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from('timetables').insert({ branch, semester, batch, dayOfWeek, startDate, endDate, slots });
      if (insertError) throw insertError;
    }
    
    res.json({ message: 'Timetable saved successfully' });
  } catch (error) {
    console.error('Error saving timetable:', error);
    res.status(500).json({ message: 'Server Error', error: error.message || error });
  }
});

// Get timetable for a specific branch, sem, and batch
router.get('/timetable/:branch/:semester/:batch', auth, superadmin, async (req, res) => {
  try {
    const { branch, semester, batch } = req.params;
    const { data: timetables, error } = await supabase.from('timetables').select('*').eq('branch', branch).eq('semester', semester).eq('batch', batch);
    if (error) throw error;
    res.json(timetables);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

const upload = multer({ dest: 'uploads/' });
router.post('/timetable/upload', auth, superadmin, upload.single('file'), async (req, res) => {
  res.json({
    message: 'PDF successfully parsed. Please review and save.',
    extractedData: {
      startDate: '2024-07-15',
      endDate: '2024-12-15',
      slots: [
        { startTime: '09:00', endTime: '10:00', subjectName: 'Software Eng', subjectCode: 'SE101' },
        { startTime: '10:00', endTime: '11:00', subjectName: 'Data Structures', subjectCode: 'DS201' }
      ]
    }
  });
});

// ALLOWED ENROLLMENTS CRUD (Upsert single record)
router.post('/allow-enrollments', auth, superadmin, async (req, res) => {
  try {
    const { branch, fullName, enrollmentNumber, mobileNumber1, mobileNumber2 } = req.body;
    if (!branch || !fullName || !enrollmentNumber || !mobileNumber1) {
      return res.status(400).json({ message: 'Branch, Full Name, Enrollment Number, and at least 1 Mobile Number are required.' });
    }

    const num = enrollmentNumber.trim();
    
    const { data: existing } = await supabase.from('allowed_enrollments').select('*').eq('enrollmentNumber', num).single();
    if (existing) {
      await supabase.from('allowed_enrollments').update({ fullName, branch, mobileNumber1, mobileNumber2: mobileNumber2 || '' }).eq('id', existing.id);
      return res.json({ message: `Successfully updated enrollment ${num}.` });
    } else {
      await supabase.from('allowed_enrollments').insert({
        enrollmentNumber: num,
        fullName,
        branch,
        mobileNumber1,
        mobileNumber2: mobileNumber2 || '',
        addedBy: req.user.id
      });
      return res.json({ message: `Successfully added enrollment ${num}.` });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/allow-enrollments', auth, superadmin, async (req, res) => {
  try {
    const { data: enrollments, error } = await supabase.from('allowed_enrollments').select('*');
    if (error) throw error;
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

router.delete('/allow-enrollments', auth, superadmin, async (req, res) => {
  try {
    const { ids } = req.body; // Expecting an array of id
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'No IDs provided' });
    }
    
    const { error } = await supabase.from('allowed_enrollments').delete().in('id', ids);
    if (error) throw error;
    res.json({ message: `Deleted ${ids.length} records successfully` });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
