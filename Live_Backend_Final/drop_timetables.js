const mongoose = require('mongoose');
const URI = 'mongodb://localhost:27017/attendance_system';

mongoose.connect(URI)
  .then(async () => {
    try {
      await mongoose.connection.db.dropCollection('timetables');
      console.log('Timetables collection dropped successfully.');
    } catch (err) {
      console.error('Error dropping collection:', err.message);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
