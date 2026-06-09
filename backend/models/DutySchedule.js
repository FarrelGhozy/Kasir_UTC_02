// models/DutySchedule.js - Skema Jadwal Piket Kebersihan
const mongoose = require('mongoose');

const dutyScheduleSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User wajib diisi']
  },
  day: {
    type: String,
    required: [true, 'Hari wajib diisi'],
    enum: {
      values: ['senin', 'selasa', 'rabu', 'kamis', 'jumat'],
      message: '{VALUE} bukan hari yang valid'
    }
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

dutyScheduleSchema.index({ day: 1 });
dutyScheduleSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('DutySchedule', dutyScheduleSchema);
