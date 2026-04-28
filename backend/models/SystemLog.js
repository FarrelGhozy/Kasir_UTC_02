const mongoose = require('mongoose');

const systemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['ERROR', 'INFO', 'WARN'],
    default: 'INFO'
  },
  source: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SystemLog', systemLogSchema);
