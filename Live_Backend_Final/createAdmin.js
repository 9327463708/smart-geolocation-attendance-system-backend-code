const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/college-attendance')
  .then(async () => {
    console.log('Connected to DB. Creating Admin...');
    const adminExists = await User.findOne({ role: 'superadmin' });
    
    if (adminExists) {
      console.log('Admin already exists!');
      process.exit();
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const admin = new User({
      name: 'Principal Sir',
      enrollmentNumber: 'ADMIN',
      email: 'admin@college.com',
      password: hashedPassword,
      role: 'superadmin'
    });

    await admin.save();
    console.log('Admin created! Login with:');
    console.log('Enrollment: ADMIN');
    console.log('Password: admin123');
    process.exit();
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
