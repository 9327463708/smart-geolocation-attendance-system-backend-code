const mongoose = require('mongoose');
async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/college-attendance');
  const user = await mongoose.connection.collection('users').findOne({ enrollmentNumber: '231210107001' });
  console.log('Photo exists?', !!user.photo, 'Length:', user.photo ? user.photo.length : 0);
  process.exit(0);
}
check();
