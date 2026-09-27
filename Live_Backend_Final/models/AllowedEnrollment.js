const mongoose = require('mongoose');

const allowedEnrollmentSchema = new mongoose.Schema({
  enrollmentNumber: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  branch: { type: String, required: true },
  mobileNumber1: { type: String, required: true },
  mobileNumber2: { type: String, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isRegistered: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('AllowedEnrollment', allowedEnrollmentSchema);