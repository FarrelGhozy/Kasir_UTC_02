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
  },
  duty_role: {
    type: String,
    required: [true, 'Tugas piket wajib diisi'],
    enum: {
      values: ['Equipment', 'Admin', 'Chief', 'Secretary', 'PDD'],
      message: '{VALUE} bukan tugas piket yang valid'
    }
  },
  time: {
    type: String,
    default: '21:30',
    match: [/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format waktu tidak valid. Gunakan format HH:MM']
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

// Index untuk query per hari
dutyScheduleSchema.index({ day: 1 });
dutyScheduleSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('DutySchedule', dutyScheduleSchema);
