const mongoose = require('mongoose');
const User = require('./models/User');
mongoose.connect('mongodb://localhost:27017/college-attendance').then(async () => {
  const u = await User.findOne({ enrollmentNumber: '6829071668' });
  console.log(u ? JSON.stringify({name: u.name, role: u.role, enrollmentNumber: u.enrollmentNumber}) : 'NOT FOUND');
  process.exit();
});
