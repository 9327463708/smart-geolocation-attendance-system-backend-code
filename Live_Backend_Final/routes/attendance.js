const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { auth, facultyOrAdmin, superadmin } = require('../middleware/auth');
const { getDistanceFromLatLonInMeters } = require('../utils/geo');

// Mark Attendance (Student & Faculty)
router.post('/mark', auth, async (req, res) => {
  try {
    const { latitude, longitude, batch, qrToken } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ message: 'Location is required to mark attendance.' });
    }
    
    const { data: user } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    if (user.role === 'student' && !qrToken) {
      return res.status(400).json({ message: 'QR Code scan is required to mark attendance.' });
    }

    // 1. Validate Location
    let { data: configs } = await supabase.from('config').select('*').limit(1);
    let config = configs && configs.length > 0 ? configs[0] : null;
    if (!config) {
      config = { collegeLocation: { latitude: 23.0225, longitude: 72.5714 }, allowedRadiusMeters: 100 };
    }

    const distance = getDistanceFromLatLonInMeters(
      latitude, longitude, config.collegeLocation.latitude, config.collegeLocation.longitude
    );

    if (distance > config.allowedRadiusMeters) {
      return res.status(400).json({ message: 'You are outside the college premises!', distance: Math.round(distance) });
    }

    // 2. Timetable Logic
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()];
    const now = new Date();
    const currentHours = now.getHours().toString().padStart(2, '0');
    const currentMinutes = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    
    let activeSlot = null;

    if (user.role === 'student') {
      if (!user.branch || !user.semester) {
        return res.status(400).json({ message: 'Branch and Semester not set for this student.' });
      }
      
      if (!batch) {
        return res.status(400).json({ message: 'Please select a batch to mark attendance.' });
      }

      const { data: timetable } = await supabase.from('timetables')
        .select('*')
        .eq('branch', user.branch)
        .eq('semester', user.semester)
        .eq('batch', batch)
        .single();

      if (!timetable || !timetable.slots || timetable.slots.length === 0) {
        return res.status(400).json({ message: 'No timetable found for today.' });
      }

      if (now < new Date(timetable.startDate) || now > new Date(timetable.endDate)) {
         return res.status(400).json({ message: 'This semester\'s term is currently not active (Check Start/End dates).' });
      }

      activeSlot = timetable.slots.find(slot => {
        return slot.dayOfWeek === currentDay && currentTimeStr >= slot.startTime && currentTimeStr <= slot.endTime;
      });

      if (!activeSlot) {
        return res.status(400).json({ message: 'No lecture is currently ongoing according to your timetable.' });
      }

      // Find the faculty teaching this subject to validate the QR token
      const { data: facultyForSubject } = await supabase.from('users').select('*').eq('role', 'faculty').eq('subjectName', activeSlot.subjectName).single();
      if (facultyForSubject) {
        if (!facultyForSubject.activeQrToken || qrToken !== facultyForSubject.activeQrToken) {
          return res.status(400).json({ message: 'Invalid or Expired QR Code scanned for this lecture.' });
        }
      }

    } else if (user.role === 'faculty') {
      const { data: allTimetables } = await supabase.from('timetables').select('*');
      let foundSlot = false;

      for (let t of (allTimetables || [])) {
        if (now >= new Date(t.startDate) && now <= new Date(t.endDate)) {
          const slot = t.slots.find(s => s.dayOfWeek === currentDay && currentTimeStr >= s.startTime && currentTimeStr <= s.endTime && s.subjectName === user.subjectName);
          if (slot) {
            activeSlot = slot;
            foundSlot = true;
            break;
          }
        }
      }

      if (!foundSlot) {
        return res.status(400).json({ message: 'No lecture is scheduled for your subject at this time according to the timetables.' });
      }
    } else {
      return res.status(403).json({ message: 'Admins do not mark attendance.' });
    }

    // 3. Check if already marked for this SPECIFIC slot today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingAttendance } = await supabase.from('attendance')
      .select('*')
      .eq('studentId', req.user.id)
      .gte('date', startOfDay.toISOString())
      .lte('date', endOfDay.toISOString())
      .eq('slotTime', `${activeSlot.startTime} - ${activeSlot.endTime}`)
      .single();

    if (existingAttendance) {
      return res.status(400).json({ message: `Attendance already marked for ${activeSlot.subjectName}!` });
    }

    // 4. Mark present
    const { data: newAttendance, error: insErr } = await supabase.from('attendance').insert({
      studentId: req.user.id,
      date: new Date().toISOString(),
      status: 'Present',
      location: { latitude, longitude },
      distanceFromCollege: Math.round(distance),
      subjectName: activeSlot.subjectName,
      slotTime: `${activeSlot.startTime} - ${activeSlot.endTime}`,
      approved: user.role === 'faculty' ? true : false
    }).select().single();

    if (insErr) throw insErr;
    res.json({ message: `Attendance marked successfully for ${activeSlot.subjectName}!`, attendance: newAttendance });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Faculty: Generate a new dynamic QR Token for today's lecture
router.post('/generate-qr', auth, facultyOrAdmin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(16).toString('hex');
    const { data: user, error } = await supabase.from('users').update({ activeQrToken: token }).eq('id', req.user.id).select().single();
    if (error) throw error;
    res.json({ token: user.activeQrToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Faculty: Get current active QR Token
router.get('/active-qr', auth, facultyOrAdmin, async (req, res) => {
  try {
    const { data: user } = await supabase.from('users').select('activeQrToken').eq('id', req.user.id).single();
    res.json({ token: user.activeQrToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Student: Get own attendance history
router.get('/my-history', auth, async (req, res) => {
  try {
    const { data: attendances } = await supabase
      .from('attendance')
      .select('*, studentId(branch, semester, batch)')
      .eq('studentId', req.user.id)
      .eq('approved', true)
      .order('date', { ascending: false });
      
    // Transform studentId to object for frontend compatibility if needed, or leave it. We'll map it to match mongoose populate.
    const history = (attendances || []).map(a => ({...a, studentId: a.studentId}));

    const { data: student } = await supabase.from('users').select('*').eq('id', req.user.id).single();
    const { data: allAttendances } = await supabase.from('attendance').select('*, studentId(id, branch, semester, batch)').eq('approved', true);
    
    const classSessionsPerDay = {};
    (allAttendances || []).forEach(att => {
        if (att.studentId && att.studentId.branch === student.branch && att.studentId.semester === student.semester && att.studentId.batch === student.batch) {
            const dateStr = new Date(att.date).toISOString().split('T')[0];
            if (!classSessionsPerDay[dateStr]) classSessionsPerDay[dateStr] = new Set();
            classSessionsPerDay[dateStr].add(att.slotTime || att.subjectName);
        }
    });

    const studentSessionsPerDay = {};
    (history || []).forEach(att => {
        const dateStr = new Date(att.date).toISOString().split('T')[0];
        if (!studentSessionsPerDay[dateStr]) studentSessionsPerDay[dateStr] = new Set();
        studentSessionsPerDay[dateStr].add(att.slotTime || att.subjectName);
    });

    let totalWorkingLectures = 0;
    let strictPresentLectures = 0;
    let finalPercentage = 0;

    const sortedDates = Object.keys(classSessionsPerDay).sort();

    for (const date of sortedDates) {
        const heldToday = classSessionsPerDay[date].size;
        
        if (heldToday > 0) {
            totalWorkingLectures += heldToday;
            const attendedToday = studentSessionsPerDay[date] ? studentSessionsPerDay[date].size : 0;
            const hasEmergency = student.emergencyLeaves && student.emergencyLeaves.includes(date);
            
            if (attendedToday >= heldToday || hasEmergency) {
                strictPresentLectures += (hasEmergency ? attendedToday : heldToday);
                finalPercentage += 1.5;
            } else if (attendedToday === 0) {
                finalPercentage -= 1.5;
            }

            if (finalPercentage < 0) finalPercentage = 0;
            if (finalPercentage > 100) finalPercentage = 100;
        }
    }

    const attendancePercentage = finalPercentage.toFixed(2);

    res.json({
      history,
      stats: {
        totalWorkingDays: totalWorkingLectures,
        presentDays: strictPresentLectures,
        attendancePercentage
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin/Faculty: Get today's attendance list
router.get('/today', auth, facultyOrAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let query = supabase.from('attendance')
      .select('*, studentId(name, enrollmentNumber, branch, semester, photo)')
      .gte('date', startOfDay.toISOString())
      .lte('date', endOfDay.toISOString());
      
    if (req.user.role === 'faculty') {
      const { data: faculty } = await supabase.from('users').select('subjectName').eq('id', req.user.id).single();
      if (faculty.subjectName) query = query.eq('subjectName', faculty.subjectName);
    }

    const { data: attendances } = await query;
    res.json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Faculty: Final Approve today's attendance
router.post('/approve-today', auth, facultyOrAdmin, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    let query = supabase.from('attendance')
      .update({ approved: true })
      .gte('date', startOfDay.toISOString())
      .lte('date', endOfDay.toISOString())
      .eq('approved', false);
      
    if (req.user.role === 'faculty') {
      const { data: faculty } = await supabase.from('users').select('subjectName').eq('id', req.user.id).single();
      if (faculty.subjectName) query = query.eq('subjectName', faculty.subjectName);
    }

    await query;

    res.json({ message: 'Today\'s attendance for your subject has been finally approved and submitted.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin/Faculty: Get all past attendance history
router.get('/all-history', auth, facultyOrAdmin, async (req, res) => {
  try {
    const { data: attendances } = await supabase
      .from('attendance')
      .select('*, studentId(name, enrollmentNumber, photo)')
      .eq('approved', true)
      .order('date', { ascending: false });
    res.json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin/Faculty: Delete or invalidate an attendance
router.delete('/:id', auth, facultyOrAdmin, async (req, res) => {
  try {
    const { data: attendance } = await supabase.from('attendance').select('*').eq('id', req.params.id).single();
    if (!attendance) {
      return res.status(404).json({ message: 'Attendance record not found.' });
    }
    await supabase.from('attendance').delete().eq('id', req.params.id);
    res.json({ message: 'Attendance record deleted successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin: Get Summary Report
router.get('/summary-report', auth, superadmin, async (req, res) => {
  try {
    const { data: students } = await supabase.from('users').select('id, name, enrollmentNumber, mobileNumber, photo, branch, semester, batch, emergencyLeaves').eq('role', 'student');
    
    const { data: allAttendances } = await supabase.from('attendance').select('*, studentId(id, branch, semester, batch)').eq('approved', true);
    
    const classSessionsPerDay = {}; 
    (allAttendances || []).forEach(att => {
        if (att.studentId && att.studentId.branch && att.studentId.semester && att.studentId.batch) {
            const dateStr = new Date(att.date).toISOString().split('T')[0];
            const groupKey = `${att.studentId.branch}-${att.studentId.semester}-${att.studentId.batch}-${dateStr}`;
            
            if (!classSessionsPerDay[groupKey]) classSessionsPerDay[groupKey] = new Set();
            classSessionsPerDay[groupKey].add(att.slotTime || att.subjectName);
        }
    });

    for (let stu of (students || [])) {
        stu._id = stu.id;
        const studentAttendances = (allAttendances || []).filter(att => att.studentId && att.studentId.id === stu.id);
        const studentSessionsPerDay = {};
        
        studentAttendances.forEach(att => {
            const dateStr = new Date(att.date).toISOString().split('T')[0];
            if (!studentSessionsPerDay[dateStr]) studentSessionsPerDay[dateStr] = new Set();
            studentSessionsPerDay[dateStr].add(att.slotTime || att.subjectName);
        });

        let totalWorkingLectures = 0;
        let strictPresentLectures = 0;
        let finalPercentage = 0;

        const classDates = Object.keys(classSessionsPerDay)
            .filter(key => key.startsWith(`${stu.branch}-${stu.semester}-${stu.batch}-`))
            .map(key => key.split(`${stu.branch}-${stu.semester}-${stu.batch}-`)[1])
            .sort();

        for (const dateStr of classDates) {
            const key = `${stu.branch}-${stu.semester}-${stu.batch}-${dateStr}`;
            const heldToday = classSessionsPerDay[key].size;
            
            if (heldToday > 0) {
                totalWorkingLectures += heldToday;
                const attendedToday = studentSessionsPerDay[dateStr] ? studentSessionsPerDay[dateStr].size : 0;
                const hasEmergency = stu.emergencyLeaves && stu.emergencyLeaves.includes(dateStr);
                
                if (attendedToday >= heldToday || hasEmergency) {
                    strictPresentLectures += (hasEmergency ? attendedToday : heldToday);
                    finalPercentage += 1.5;
                } else if (attendedToday === 0) {
                    finalPercentage -= 1.5;
                }

                if (finalPercentage < 0) finalPercentage = 0;
                if (finalPercentage > 100) finalPercentage = 100;
            }
        }

        stu.presentDays = strictPresentLectures;
        stu.totalWorkingDays = totalWorkingLectures;
        stu.attendancePercentage = finalPercentage.toFixed(2);
    }

    res.json(students);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin/Faculty: Grant Emergency Leave to a Student
router.post('/grant-emergency', auth, facultyOrAdmin, async (req, res) => {
  try {
    const { studentId, date } = req.body;
    if (!studentId || !date) {
      return res.status(400).json({ message: 'Student ID and date are required' });
    }

    const { data: student } = await supabase.from('users').select('*').eq('id', studentId).single();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const leaves = student.emergencyLeaves || [];
    if (!leaves.includes(date)) {
      leaves.push(date);
      await supabase.from('users').update({ emergencyLeaves: leaves }).eq('id', student.id);
    }

    res.json({ message: 'Emergency leave granted successfully for ' + date });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Faculty/Admin: Get students on official leave today
router.get('/on-leave-today', auth, facultyOrAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    // Supabase jsonb query isn't perfectly like mongo's $exists, so we just fetch all students with officialLeaves non-null and filter in JS
    const { data: users } = await supabase.from('users').select('id, name, enrollmentNumber, officialLeaves').eq('role', 'student').not('officialLeaves', 'is', null);
    
    const onLeaveToday = (users || []).filter(u => {
      return (u.officialLeaves || []).some(leave => {
        return today >= leave.startDate && today <= leave.endDate;
      });
    });
    
    const result = onLeaveToday.map(u => {
      const leave = u.officialLeaves.find(l => today >= l.startDate && today <= l.endDate);
      return {
        _id: u.id,
        name: u.name,
        enrollmentNumber: u.enrollmentNumber,
        document: leave.document
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// Admin: Grant Long Leave
router.post('/grant-long-leave', auth, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only Admin can grant long leaves' });
    }
    
    const { enrollmentNumber, startDate, endDate, document } = req.body;
    if (!enrollmentNumber || !startDate || !endDate || !document) {
      return res.status(400).json({ message: 'Enrollment number, start date, end date, and signature document are required' });
    }

    const { data: student } = await supabase.from('users').select('*').eq('enrollmentNumber', enrollmentNumber).eq('role', 'student').single();
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({ message: 'Start date must be before or equal to end date' });
    }

    const datesToGrant = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      datesToGrant.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const emergencyLeaves = student.emergencyLeaves || [];
    const officialLeaves = student.officialLeaves || [];
    
    let addedCount = 0;
    datesToGrant.forEach(date => {
      if (!emergencyLeaves.includes(date)) {
        emergencyLeaves.push(date);
        addedCount++;
      }
    });

    officialLeaves.push({
      startDate,
      endDate,
      document
    });

    await supabase.from('users').update({ emergencyLeaves, officialLeaves }).eq('id', student.id);
    res.json({ message: `Official Leave granted successfully for ${addedCount} day(s) to ${student.name}.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
