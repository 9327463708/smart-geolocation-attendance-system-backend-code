const express = require('express');
const bcrypt = require('bcryptjs');
const supabase = require('../supabaseClient');
const { auth, superadmin } = require('../middleware/auth');
const router = express.Router();

// Get all students
router.get('/', auth, superadmin, async (req, res) => {
  try {
    const { data: students, error: stuError } = await supabase
      .from('users')
      .select('id, name, enrollmentNumber, email, mobileNumber, branch, semester, batch, role, emergencyLeaves, officialLeaves')
      .eq('role', 'student')
      .order('branch', { ascending: true })
      .order('semester', { ascending: true })
      .order('batch', { ascending: true })
      .order('enrollmentNumber', { ascending: true });
      
    if (stuError) throw stuError;
    
    const { data: allAttendances, error: attError } = await supabase
      .from('attendance')
      .select('*, users!inner(id, branch, semester, batch)')
      .eq('approved', true);

    if (attError) throw attError;

    for (let stu of students) {
      const classSessionsPerDay = {};
      const studentSessionsPerDay = {};

      allAttendances.forEach(att => {
        if (!att.users) return;
        const dateStr = new Date(att.date).toISOString().split('T')[0];
        
        // Use users info returned from join
        const studentInfo = att.users;
        
        if (studentInfo.branch === stu.branch && studentInfo.semester === stu.semester && studentInfo.batch === stu.batch) {
            if (!classSessionsPerDay[dateStr]) classSessionsPerDay[dateStr] = new Set();
            classSessionsPerDay[dateStr].add(att.slotTime || att.subjectName);
        }

        if (att.studentId === stu.id) {
            if (!studentSessionsPerDay[dateStr]) studentSessionsPerDay[dateStr] = new Set();
            studentSessionsPerDay[dateStr].add(att.slotTime || att.subjectName);
        }
      });

      let finalPercentage = 0;
      const sortedDates = Object.keys(classSessionsPerDay).sort();

      for (const date of sortedDates) {
          const heldToday = classSessionsPerDay[date].size;
          if (heldToday > 0) {
              const attendedToday = studentSessionsPerDay[date] ? studentSessionsPerDay[date].size : 0;
              const hasEmergency = stu.emergencyLeaves && stu.emergencyLeaves.includes(date);
              
              if (attendedToday >= heldToday || hasEmergency) {
                  finalPercentage += 1.5;
              } else if (attendedToday === 0) {
                  finalPercentage -= 1.5;
              }
              if (finalPercentage < 0) finalPercentage = 0;
              if (finalPercentage > 100) finalPercentage = 100;
          }
      }
      stu.attendancePercentage = finalPercentage.toFixed(2);
      stu._id = stu.id; // Map id to _id for frontend compatibility
    }

    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Add or Update a student
router.post('/add', auth, superadmin, async (req, res) => {
  try {
    const { name, enrollmentNumber, email, mobileNumber, branch, semester, batch, password } = req.body;

    const { data: user } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).single();
    
    if (user) {
      // Check if this is a promotion to a new semester
      const isNewSemester = user.semester !== parseInt(semester, 10);
      
      const updateData = {
        name,
        email,
        mobileNumber,
        branch,
        semester
      };
      if (batch) updateData.batch = batch;
      
      if (password && password.trim() !== '') {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(password, salt);
      }
      
      // If semester changed, wipe old leaves for the new semester
      if (isNewSemester) {
        updateData.emergencyLeaves = [];
        updateData.officialLeaves = [];
      }
      
      const { error: updateError } = await supabase.from('users').update(updateData).eq('id', user.id);
      if (updateError) throw updateError;
      
      return res.status(200).json({ message: 'Student details updated successfully' + (isNewSemester ? ' and previous leaves cleared for the new semester!' : '!'), student: { name, enrollmentNumber, semester, batch: updateData.batch || user.batch } });
    } else {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password || 'student123', salt);

      const { error: insertError } = await supabase.from('users').insert({
        name,
        enrollmentNumber,
        email,
        mobileNumber,
        branch,
        semester,
        batch: batch || 'A',
        password: hashedPassword,
        role: 'student'
      });
      if (insertError) throw insertError;

      res.status(201).json({ message: 'Student added successfully!', student: { name, enrollmentNumber } });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Delete a student
router.delete('/:id', auth, superadmin, async (req, res) => {
  try {
    const { data: user, error: fetchErr } = await supabase.from('users').select('*').eq('id', req.params.id).single();
    if (fetchErr || !user) return res.status(404).json({ message: 'Student not found.' });
    if (user.role === 'superadmin' || user.role === 'faculty') return res.status(403).json({ message: 'Cannot delete admin/faculty from here.' });

    const { error: delErr } = await supabase.from('users').delete().eq('id', req.params.id);
    if (delErr) throw delErr;

    res.json({ message: 'Student deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get current student profile
router.get('/me', auth, async (req, res) => {
  try {
    const { data: user, error } = await supabase.from('users').select('id, name, enrollmentNumber, email, mobileNumber, branch, semester, batch, role, photo, emergencyLeaves, officialLeaves, subjectName, subjectCode').eq('id', req.user.id).single();
    if (error || !user) return res.status(404).json({ message: 'User not found' });
    user._id = user.id; // Compatibility
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Update academic profile (branch, semester, batch)
router.put('/academic-profile', auth, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can update academic profile here' });
    }

    const { branch, semester, batch } = req.body;
    const updateData = {};
    if (branch) updateData.branch = branch;
    if (semester) updateData.semester = semester;
    if (batch) updateData.batch = batch;

    const { error } = await supabase.from('users').update(updateData).eq('id', user.id);
    if (error) throw error;

    res.json({ message: 'Academic profile updated successfully', user: { branch: branch || user.branch, semester: semester || user.semester, batch: batch || user.batch } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Upload student photo
router.post('/photo', auth, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can upload a photo' });
    }

    const { photoBase64 } = req.body;
    if (!photoBase64) return res.status(400).json({ message: 'Photo is required' });

    const { error } = await supabase.from('users').update({ photo: photoBase64 }).eq('id', user.id);
    if (error) throw error;

    res.json({ message: 'Photo uploaded successfully!', photo: photoBase64 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});


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

module.exports = router;
