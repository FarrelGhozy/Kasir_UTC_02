const mongoose = require('mongoose');
const User = require('../../models/User');

describe('User - Password Hashing', () => {
  it('should hash password on save', async () => {
    const user = await User.create({
      name: 'Test',
      username: 'test_hash_' + Date.now(),
      password: 'password123',
      role: 'kasir'
    });
    expect(user.password).not.toBe('password123');
    expect(user.password).toMatch(/^\$2[ab]\$.{56}$/);
    const queried = await User.findById(user._id).lean();
    expect(queried.password).toBeUndefined();
    const raw = await User.findById(user._id).select('+password').lean();
    expect(raw.password).not.toBe('password123');
    expect(raw.password).toMatch(/^\$2[ab]\$.{56}$/);
  });

  it('should not re-hash if password unchanged', async () => {
    const user = await User.create({
      name: 'Test',
      username: 'test_rehash_' + Date.now(),
      password: 'password123',
      role: 'kasir'
    });
    const passwordBefore = (await User.findById(user._id).select('+password').lean()).password;
    user.name = 'Updated';
    await user.save();
    const passwordAfter = (await User.findById(user._id).select('+password').lean()).password;
    expect(passwordAfter).toBe(passwordBefore);
  });
});

describe('User - comparePassword', () => {
  it('should return true for correct password', async () => {
    const user = await User.create({
      name: 'Test', username: 'test_comp_' + Date.now(),
      password: 'password123', role: 'kasir'
    });
    const isMatch = await user.comparePassword('password123');
    expect(isMatch).toBe(true);
  });

  it('should return false for incorrect password', async () => {
    const user = await User.create({
      name: 'Test', username: 'test_comp2_' + Date.now(),
      password: 'password123', role: 'kasir'
    });
    const isMatch = await user.comparePassword('wrongpassword');
    expect(isMatch).toBe(false);
  });
});

describe('User - findByCredentials', () => {
  it('should find user with correct credentials', async () => {
    const username = 'test_find_' + Date.now();
    await User.create({
      name: 'Test', username,
      password: 'password123', role: 'kasir'
    });
    const user = await User.findByCredentials(username, 'password123');
    expect(user).toBeTruthy();
    expect(user.username).toBe(username);
  });

  it('should throw for wrong username', async () => {
    await expect(
      User.findByCredentials('nonexistent_user', 'password123')
    ).rejects.toThrow('Username atau password salah');
  });

  it('should throw for wrong password', async () => {
    const username = 'test_wrong_' + Date.now();
    await User.create({
      name: 'Test', username, password: 'password123', role: 'kasir'
    });
    await expect(
      User.findByCredentials(username, 'wrongpassword')
    ).rejects.toThrow('Username atau password salah');
  });
});

describe('User - toJSON', () => {
  it('should strip password and __v', async () => {
    const user = await User.create({
      name: 'Test', username: 'test_json_' + Date.now(),
      password: 'password123', role: 'kasir'
    });
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.__v).toBeUndefined();
  });
});

describe('User - Validation', () => {
  it('should reject short username', async () => {
    await expect(User.create({
      name: 'Test', username: 'ab', password: 'pass123', role: 'kasir'
    })).rejects.toThrow('minimal');
  });

  it('should reject invalid role', async () => {
    await expect(User.create({
      name: 'Test', username: 'test_role_' + Date.now(),
      password: 'pass123', role: 'superadmin'
    })).rejects.toThrow('bukan peran');
  });

  it('should reject duplicate username', async () => {
    const username = 'test_dup_' + Date.now();
    await User.create({ name: 'A', username, password: 'pass123', role: 'kasir' });
    await expect(User.create({
      name: 'B', username, password: 'pass456', role: 'admin'
    })).rejects.toThrow();
  });
});
