const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chat.db');

console.log("Starting DB Fix...");

db.serialize(() => {
    // 1. Try to add the column. If it exists, this will fail, which is fine.
    db.run("ALTER TABLE users ADD COLUMN login_id TEXT UNIQUE", function (err) {
        if (err) {
            console.log("ALTER TABLE result:", err.message);
        } else {
            console.log("Column 'login_id' added successfully.");
        }

        // 2. Now try to update the admin user
        updateAdmin();
    });
});

function updateAdmin() {
    db.get("SELECT * FROM users WHERE email = 'admin@chat.com'", (err, admin) => {
        if (err) {
            console.error("Error fetching admin:", err);
            return;
        }

        if (!admin) {
            console.log("Admin user not found.");
            return;
        }

        console.log("Found Admin ID:", admin.id);

        db.run("UPDATE users SET login_id = 'admin' WHERE id = ?", [admin.id], function (err) {
            if (err) {
                console.error("Error updating admin login_id:", err.message);
            } else {
                console.log("Admin login_id updated successfully. Rows affected:", this.changes);
            }

            // Final verification
            db.get("SELECT id, email, login_id FROM users WHERE id = ?", [admin.id], (err, row) => {
                console.log("Final User Record:", row);
            });
        });
    });
}
