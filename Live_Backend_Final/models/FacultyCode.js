const mongoose = require('mongoose');

const facultyCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true }, // 10-digit code
  facultyName: { type: String, required: true },
  subjectName: { type: String, required: true },
  subjectCode: { type: String, required: true },
  isUsed: { type: Boolean, default: false } // Becomes true when a faculty registers with it
}, { timestamps: true });

module.exports = mongoose.model('FacultyCode', facultyCodeSchema);
