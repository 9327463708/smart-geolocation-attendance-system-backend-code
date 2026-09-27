const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  enrollmentNumber: { type: String, required: true, unique: true },
  email: { type: String, required: true }, // For forgot password
  mobileNumber: { type: String }, // For student
  branch: { type: String, enum: ['Computer Engineering', 'Information Technology', 'AIDS', 'Mechanical Engineering'] }, // For Student
  semester: { type: Number, min: 1, max: 8 }, // For Student
  batch: { type: String, enum: ['A', 'B', 'C'] }, // For Student
  password: { type: String, required: true },
  subjectName: { type: String }, // For Faculty
  subjectCode: { type: String }, // For Faculty
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  role: { type: String, enum: ['student', 'faculty', 'superadmin'], default: 'student' },
  photo: { type: String }, // Base64 string for student photo
  lastPhotoUploadSemester: { type: Number }, // To track if uploaded for current semester
  activeQrToken: { type: String }, // For Faculty: stores the dynamically generated QR code token
  emergencyLeaves: [{ type: String }], // Array of YYYY-MM-DD dates where student has an emergency leave
  officialLeaves: [{
    startDate: String,
    endDate: String,
    document: String, // Base64 image/pdf of HOD signature
    grantedOn: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
