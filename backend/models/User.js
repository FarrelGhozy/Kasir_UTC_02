// models/User.js - User Schema with Role-based Access
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [50, 'Username cannot exceed 50 characters']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default in queries
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'teknisi', 'kasir'],
      message: '{VALUE} is not a valid role'
    },
    required: [true, 'Role is required'],
    default: 'kasir'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for faster queries
// userSchema.index({ username: 1 });
// userSchema.index({ role: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function() {
  // Only hash if password is modified
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Static method to find user by username with password
userSchema.statics.findByCredentials = async function(username, password) {
  const user = await this.findOne({ username }).select('+password');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    throw new Error('Invalid credentials');
  }

  return user;
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);