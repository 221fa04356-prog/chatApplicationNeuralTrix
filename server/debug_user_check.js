const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const checkUser = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const user = await User.findOne({ name: { $regex: /siana/i } });
        console.log('User found:', user);

        if (user) {
            console.log('Designation field:', user.designation);
            if (!user.designation) {
                console.log('Designation is missing. Updating it...');
                user.designation = 'Developer'; // Defaulting to Developer as per user request context (implied)
                await user.save();
                console.log('Updated designation to Developer');
            }
        } else {
            console.log('User siana not found');
        }

        mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

checkUser();
