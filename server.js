const express = require("express");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const cors = require("cors");

// 1. Create the Express app
const app = express();

// 2. Middleware
app.use(express.json());
app.use(cors());

// 3. Serve Static Files
app.use(express.static("public"));

// 4. MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Elie/2004",
    database: "hotelOnCall"
});

// 5. Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL Connection Failed: ", err);
    } else {
        console.log("✅ MySQL Connected to hotelOnCall");
    }
});

// 6. Registration Route (Fixed Query Execution)
app.post("/register", async (req, res) => {
    try {
        const { email, password, userType } = req.body;

        // Check if any field is missing
        if (!email || !password || !userType) {
            return res.status(400).json({ message: "Please provide all required fields." });
        }

        // Check if user already exists
        db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
            if (err) {
                console.error("Error checking user existence:", err);
                return res.status(500).json({ message: "Database error occurred." });
            }

            if (result.length > 0) {
                return res.json({ message: "User already exists!" });
            }

            try {
                // Hash password
                const hashedPassword = await bcrypt.hash(password, 10);

                // Insert user into MySQL
                db.query(
                    "INSERT INTO users (email, password, userType) VALUES (?, ?, ?)",
                    [email, hashedPassword, userType],
                    (err) => {
                        if (err) {
                            console.error("Error registering user:", err);
                            return res.status(500).json({ message: "Error registering user!" });
                        }
                        res.json({ message: "User registered successfully!" });
                    }
                );
            } catch (error) {
                console.error("Password Hashing Error:", error);
                return res.status(500).json({ message: "Error processing registration." });
            }
        });
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).json({ message: "Server error during registration." });
    }
});

// 7. Login Route (Fixed Password Verification)
app.post("/login", (req, res) => {
    const { email, password, userType } = req.body;

    // Check if any field is missing
    if (!email || !password || !userType) {
        return res.status(400).json({ message: "Please provide all required fields." });
    }

    db.query("SELECT * FROM users WHERE email = ? AND userType = ?", [email, userType], async (err, result) => {
        if (err) {
            console.error("Error finding user:", err);
            return res.status(500).json({ message: "Database error occurred." });
        }

        if (result.length === 0) {
            return res.json({ message: "User not found!" });
        }

        const user = result[0];

        try {
            // Verify Password
            const isMatch = await bcrypt.compare(password, user.password);
            if (isMatch) {
                res.json({ message: `Welcome ${userType}! Login successful!` });
            } else {
                res.json({ message: "Invalid credentials!" });
            }
        } catch (error) {
            console.error("Error comparing passwords:", error);
            res.status(500).json({ message: "Server error during login." });
        }
    });
});

// 8. Start the Server
app.listen(5000, () => {
    console.log("✅ Server running on port 5000");
});
