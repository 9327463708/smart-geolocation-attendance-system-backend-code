const express = require('express');
const router = express.Router();
const supabase = require('../supabaseClient');
const { auth, superadmin } = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  try {
    const { branch, semester, batch } = req.query;
    if (!branch || !semester || !batch) return res.status(400).json({ message: 'Missing parameters' });
    
    const { data: timetable, error } = await supabase.from('timetables').select('*').eq('branch', branch).eq('semester', semester).eq('batch', batch).single();
    if (error && error.code === 'PGRST116') { // not found
      return res.json({ empty: true });
    } else if (error) {
      throw error;
    }
    
    res.json(timetable);
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

router.post('/', auth, superadmin, async (req, res) => {
  try {
    const { branch, semester, batch, startDate, endDate, slots } = req.body;
    const { data: existing } = await supabase.from('timetables').select('*').eq('branch', branch).eq('semester', semester).eq('batch', batch).single();
    
    if (existing) {
      await supabase.from('timetables').update({ startDate, endDate, slots }).eq('id', existing.id);
    } else {
      await supabase.from('timetables').insert({ branch, semester, batch, startDate, endDate, slots });
    }
    
    res.json({ message: 'Timetable saved successfully!' });
  } catch (error) {
    console.error('Error saving timetable:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
