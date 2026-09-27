const mongoose = require('mongoose');

const SlotSchema = new mongoose.Schema({
  startTime: { type: String, required: true }, // Format "HH:mm" (24-hour)
  endTime: { type: String, required: true }, // Format "HH:mm"
  subjectName: { type: String, required: true },
  facultyName: { type: String, required: true },
  facultyCode: { type: String, required: true }
});

const TimetableSchema = new mongoose.Schema({
  branch: { 
    type: String, 
    required: true, 
    enum: ['Computer Engineering', 'Information Technology', 'AIDS', 'Mechanical Engineering'] 
  },
  semester: { 
    type: Number, 
    required: true,
    min: 1,
    max: 8
  },
  batch: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C'],
    default: 'A'
  },
  dayOfWeek: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  slots: [SlotSchema]
}, { timestamps: true });

// Ensure unique timetable per branch, sem, batch and day
TimetableSchema.index({ branch: 1, semester: 1, batch: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', TimetableSchema);
