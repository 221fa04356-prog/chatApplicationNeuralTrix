const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./chat.db');

db.get("SELECT * FROM users WHERE email = 'admin@chat.com'", async (err, user) => {
    if (err) {
        console.error("DB Error:", err);
        return;
    }
    if (!user) {
        console.error("User 'admin@chat.com' NOT FOUND");
        return;
    }

    console.log("User Record:", user);

    // Test Password
    const match = await bcrypt.compare('admin123', user.password);
    console.log("Password 'admin123' match:", match);

    if (!match) {
        console.log("Resetting password to 'admin123'...");
        const newHash = await bcrypt.hash('admin123', 10);
        db.run("UPDATE users SET password = ? WHERE id = ?", [newHash, user.id], (err) => {
            if (!err) console.log("Password reset successful.");
            else console.error("Reset failed:", err);
        });
    }
});
