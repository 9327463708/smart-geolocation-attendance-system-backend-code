const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect('mongodb://localhost:27017/college-attendance')
  .then(async () => {
    const users = await User.find({ role: 'student' });
    console.log("Students in DB:", users.map(u => ({ email: u.email, name: u.name, password: u.password })));
    process.exit(0);
  });
