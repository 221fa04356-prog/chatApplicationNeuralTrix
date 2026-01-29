const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Atlas Connected Successfully');

    // Seed Admin
    const adminEmail = 'admin@chat.com';
    const admin = await User.findOne({ email: adminEmail });

    if (!admin) {
      try {
        const hash = await bcrypt.hash('admin123', 10);
        await User.create({
          name: 'Admin',
          email: adminEmail,
          mobile: '0000000000',
          login_id: 'admin',
          password: hash,
          role: 'admin',
          status: 'approved'
        });
        console.log('Default Admin Account Created: admin@chat.com');
      } catch (createErr) {
        if (createErr.code === 11000) {
          console.log('Admin account already exists (Duplicate Key)');
        } else {
          console.error('Error creating admin:', createErr);
        }
      }
    } else {
      console.log('Admin account already exists.');
    }

  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
