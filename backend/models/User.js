// models/User.js - Skema Pengguna dengan Akses Berbasis Peran
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Nama wajib diisi'],
    trim: true,
    maxlength: [100, 'Nama tidak boleh lebih dari 100 karakter']
  },
  username: {
    type: String,
    required: [true, 'Username wajib diisi'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username harus minimal 3 karakter'],
    maxlength: [50, 'Username tidak boleh lebih dari 50 karakter']
  },
  password: {
    type: String,
    required: [true, 'Password wajib diisi'],
    minlength: [6, 'Password harus minimal 6 karakter'],
    select: false // Jangan kembalikan password secara default dalam query
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'teknisi', 'kasir'],
      message: '{VALUE} bukan peran yang valid'
    },
    required: [true, 'Peran (Role) wajib diisi'],
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
  timestamps: true // Menambahkan createdAt dan updatedAt secara otomatis
});

// Middleware pre-save untuk hash password
userSchema.pre('save', async function() {
  // Hanya hash jika password diubah
  if (!this.isModified('password')) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method instance untuk membandingkan password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Gagal memverifikasi password');
  }
};

// Method static untuk mencari user berdasarkan username dan password
userSchema.statics.findByCredentials = async function(username, password) {
  const user = await this.findOne({ username }).select('+password');
  
  if (!user) {
    throw new Error('Username atau password salah');
  }

  const isMatch = await user.comparePassword(password);
  
  if (!isMatch) {
    throw new Error('Username atau password salah');
  }

  return user;
};

// Hapus password dari output JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

module.exports = mongoose.model('User', userSchema);