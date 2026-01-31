const mongoose = require('mongoose');
const User = require('./server/models/User');
require('dotenv').config({ path: './server/.env' });

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const user = await User.findOne({ name: { $regex: /siana/i } });
        console.log('User found:', user);

        if (user) {
            console.log('Designation field:', user.designation);
        } else {
            console.log('User siana not found');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

checkUser();
