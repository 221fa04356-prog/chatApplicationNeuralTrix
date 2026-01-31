const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

db.serialize(() => {
    // 1. Check if login_id column exists
    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error("Error getting table info:", err);
            return;
        }

        const hasLoginId = columns.some(col => col.name === 'login_id');

        if (!hasLoginId) {
            console.log("Adding login_id column...");
            db.run("ALTER TABLE users ADD COLUMN login_id TEXT UNIQUE", runAdminUpdate);
        } else {
            console.log("login_id column already exists.");
            runAdminUpdate();
        }
    });
});

function runAdminUpdate() {
    // 2. Ensure Admin has the correct login_id
    db.get("SELECT * FROM users WHERE email = 'admin@chat.com'", (err, admin) => {
        if (err) {
            console.error("Error finding admin:", err);
            return;
        }

        if (admin) {
            console.log("Found Admin user:", admin);
            if (!admin.login_id) {
                console.log("Updating Admin login_id...");
                db.run("UPDATE users SET login_id = 'admin' WHERE email = 'admin@chat.com'", (err) => {
                    if (err) console.error("Update failed:", err);
                    else console.log("Admin login_id updated to 'admin'.");
                });
            } else {
                console.log("Admin already has login_id:", admin.login_id);
            }
        } else {
            console.log("Admin user not found! You might need to restart the server to trigger seed data.");
        }
    });

    // 3. List all users to verify
    db.all("SELECT id, name, email, login_id, role FROM users", (err, rows) => {
        if (err) console.log(err);
        else console.log("Current Users:", rows);
    });
}
