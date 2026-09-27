const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Present', 'Absent'], default: 'Present' },
  location: {
    latitude: { type: Number },
    longitude: { type: Number }
  },
  distanceFromCollege: { type: Number }, // in meters
  subjectName: { type: String }, // For lecture-wise attendance
  slotTime: { type: String }, // e.g., "09:00 - 10:00"
  approved: { type: Boolean, default: false } // Faculty final approval
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
