const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  collegeName: { type: String, default: 'My College' },
  collegeLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  allowedRadiusMeters: { type: Number, default: 100 }
}, { timestamps: true });

module.exports = mongoose.model('Config', configSchema);
