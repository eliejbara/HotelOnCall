const express = require("express");
const mysql = require("mysql2");
const bcrypt = require('bcrypt');
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// MySQL Connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Elie/2004",
    database: "hoteloncall"
});

// Connect to MySQL
db.connect((err) => {
    if (err) {
        console.error("❌ MySQL Connection Failed:", err);
        process.exit(1);
    } else {
        console.log("✅ MySQL Connected to hotelOnCall");
    }
});

// ** Serve index.html as default page **
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ** User Registration **
app.post("/register", async (req, res) => {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.length > 0) {
            return res.json({ success: false, message: "User already exists!" });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);

            db.query(
                "INSERT INTO users (email, password, userType) VALUES (?, ?, ?)",
                [email, hashedPassword, userType],
                (err) => {
                    if (err) return res.status(500).json({ success: false, message: "Error registering user!" });
                    res.json({ success: true, message: "User registered successfully!", redirectTo: "index.html" });
                }
            );
        } catch (error) {
            return res.status(500).json({ success: false, message: "Error processing registration." });
        }
    });
});

// ** User Login with Redirection Logic **
app.post("/login", (req, res) => {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    db.query("SELECT * FROM users WHERE email = ? AND userType = ?", [email, userType], async (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.length === 0) {
            return res.json({ success: false, message: "User not found!", redirectTo: "register.html" });
        }

        const user = result[0];

        try {
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.json({ success: false, message: "Invalid credentials!" });
            }

            if (userType === "guest") {
                // Check if guest has already checked in
                db.query("SELECT * FROM check_ins WHERE guest_id = ?", [user.id], (err, checkinResult) => {
                    if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

                    if (checkinResult.length > 0) {
                        // Guest already checked in → Redirect to guest services
                        return res.json({ success: true, message: "Login successful!", redirectTo: "guest_services.html", email:user.email });
                    } else {
                        // Guest not checked in → Redirect to check-in page
                        return res.json({ success: true, message: "Login successful!", redirectTo: "checkin.html",email: user.email });
                    }
                });
                return;
            } else {
                // ** Check if staff exists in the staff_roles table **
                db.query("SELECT * FROM staff_roles WHERE staff_email = ?", [email], (err, staffResult) => {
                    console.log("🔍 Checking staff role for:", email);
                    console.log("🔍 Staff Role Query Result:", staffResult); // Debugging log
                
                    if (err) {
                        console.error("❌ Database error in staff_roles:", err);
                        return res.status(500).json({ success: false, message: "Database error occurred." });
                    }
                
                    if (staffResult.length > 0) {
                        console.log("✅ Staff role found, redirecting...");
                        return res.json({ success: true, message: "Login successful!", redirectTo: "staff_selection.html" });
                    } else {
                        console.log("❌ No staff role found for this email.");
                        return res.json({ success: false, message: "Staff not registered in the system!" });
                    }
                });
                return;
            }
        } catch (error) {
            return res.status(500).json({ success: false, message: "Server error during login." });
        }
    });
});
app.get("/available-rooms", (req, res) => {
    db.query("SELECT room_number FROM rooms WHERE room_number NOT IN (SELECT room_number FROM check_ins)", (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });
        res.json(result);
    });
});

// ** Guest Check-In (Now Redirects Directly to Guest Services) **
app.post("/checkin", (req, res) => {
    const { guestEmail, roomNumber, nights } = req.body;

    if (!guestEmail || !roomNumber || !nights) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    db.query("SELECT id FROM users WHERE email = ? AND userType = 'guest'", [guestEmail], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.length === 0) {
            return res.status(400).json({ success: false, message: "Guest not registered! Please register first." });
        }

        const guestId = result[0].id;

        db.query("SELECT * FROM check_ins WHERE room_number = ?", [roomNumber], (err, roomResult) => {
            if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

            if (roomResult.length > 0) {
                return res.status(400).json({ success: false, message: "Room already booked! Choose another room." });
            }

            db.query(
                "INSERT INTO check_ins (guest_id, room_number, nights) VALUES (?, ?, ?)",
                [guestId, roomNumber, nights],
                (err) => {
                    if (err) return res.status(500).json({ success: false, message: "Error processing check-in." });
                    res.json({ success: true, message: "Check-in successful!", redirectTo: "guest_services.html" });
                }
            );
        });
    });
});

// ** Role Selection for Staff **
app.post("/select-role", (req, res) => {
    const { email, role } = req.body;

    if (!email || !role) {
        return res.status(400).json({ success: false, message: "Missing email or role." });
    }

    db.query("SELECT * FROM staff_roles WHERE staff_email = ? AND role = ?", [email, role], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.length === 0) {
            return res.status(403).json({ success: false, message: "Invalid role selection." });
        }

        // Redirect based on role
        let redirectTo = "";
        if (role === "cook") redirectTo = "cook_dashboard.html";
        else if (role === "maintenance") redirectTo = "maintenance_dashboard.html";
        else if (role === "cleaner") redirectTo = "cleaner_dashboard.html";

        res.json({ success: true, message: "Role selected successfully!", redirectTo });
    });
});
app.get("/menu", (req, res) => {
    db.query("SELECT * FROM menu", (err, result) => {
        if (err) {
            console.error("❌ Menu Fetch Error:", err);
            return res.status(500).json({ success: false, message: "Database error occurred." });
        }
        res.json(result);
    });
});


// ** Place Food Order (Multiple Items) **
app.post("/place-order", (req, res) => {
    const { guestEmail, orderItems } = req.body;

    console.log("🔍 Storing Order for:", guestEmail);
    if (!guestEmail) {
        return res.status(401).json({ success: false, message: "⚠️ You must be logged in to place an order." });
    }

    if (!orderItems || orderItems.length === 0) {
        return res.status(400).json({ success: false, message: "Invalid order request." });
    }

    let orderValues = [];
    let totalAmount = 0;

    orderItems.forEach(item => {
        orderValues.push([guestEmail, item.name, item.quantity, item.price * item.quantity, "Pending"]);
        totalAmount += item.price * item.quantity;
    });

    const sql = "INSERT INTO orders (guest_email, menu_item, quantity, total_price, order_status) VALUES ?";
    
    db.query(sql, [orderValues], (err) => {
        if (err) {
            console.error("❌ Order Placement Error:", err);
            return res.status(500).json({ success: false, message: "Error processing order." });
        }
        console.log(`✅ Order placed for ${guestEmail}: ${orderItems.length} items.`);
        res.json({ success: true, message: "Order placed successfully!", totalAmount });
    });
});

// ** Check Guest's Order Status **
app.get("/check-order/:guestEmail", (req, res) => {
    const guestEmail = req.params.guestEmail;

    db.query("SELECT * FROM orders WHERE guest_email = ? ORDER BY order_time DESC", [guestEmail], (err, result) => {
        if (err) {
            console.error("❌ Order Status Fetch Error:", err);
            return res.status(500).json({ success: false, message: "Database error occurred." });
        }
        res.json(result);
    });
});

// ** Update Order Status (Cook Updates Order) **
app.post("/update-order-status", (req, res) => {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ success: false, message: "Invalid request. Missing order ID or status." });
    }

    db.query("UPDATE orders SET order_status = ? WHERE id = ?", [status, orderId], (err, result) => {
        if (err) {
            console.error("❌ Order Status Update Error:", err);
            return res.status(500).json({ success: false, message: "Database error occurred while updating order status." });
        }

        console.log(`✅ Order ${orderId} updated to: ${status}`);
        res.json({ success: true, message: `Order updated to ${status}` });
    });
});

// ** Cook - Fetch Orders **
app.get("/cook/orders", (req, res) => {
    db.query("SELECT id, guest_email, menu_item, quantity, order_status FROM orders WHERE order_status != 'Completed'", (err, result) => {
        if (err) {
            console.error("❌ Error fetching orders:", err);
            return res.status(500).json({ success: false, message: "Database error occurred." });
        }
        console.log("🔍 Orders fetched for cook dashboard:", result);
        res.json(result);
    });
});

// ** Cook - Update Order Status **
// ** Cook - Update Order Status **
app.post("/cook/update-order", (req, res) => {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ success: false, message: "Missing order ID or status." });
    }

    db.query("UPDATE orders SET order_status = ? WHERE id = ?", [status, orderId], (err, result) => {
        if (err) {
            console.error("❌ Order Status Update Error:", err);
            return res.status(500).json({ success: false, message: "Database error while updating order status." });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        res.json({ success: true, message: `Order #${orderId} updated to ${status}` });
    });
});

// ** Serve Static Pages **
app.get("/guest_services.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "guest_services.html"));
});

app.get("/checkin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "checkin.html"));
});

app.get("/register.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/cook_dashboard.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "cook_dashboard.html"));
});
// ** Fetch Available Rooms **


// Get the guest's room number
app.get("/guest-room/:guestEmail", (req, res) => {
    const guestEmail = req.params.guestEmail;

    db.query("SELECT room_number FROM check_ins INNER JOIN users ON check_ins.guest_id = users.id WHERE users.email = ?", 
    [guestEmail], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.length > 0) {
            res.json({ success: true, room_number: result[0].room_number });
        } else {
            res.json({ success: false, message: "No active check-in found for this guest." });
        }
    });
});

// Handle maintenance request submission

app.post("/request-maintenance", (req, res) => {
    const { guestEmail, roomNumber, issueType, details } = req.body;

    console.log("Received Maintenance Request:", req.body); // Debugging log

    if (!guestEmail || !roomNumber || !issueType) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
    }

    db.query("SELECT * FROM check_ins WHERE guest_id = (SELECT id FROM users WHERE email = ? AND userType = 'guest')", 
    [guestEmail], (err, result) => {
        if (err) {
            console.error("❌ Database error checking check-in status:", err);
            return res.status(500).json({ success: false, message: "Database error occurred." });
        }

        if (result.length === 0) {
            return res.status(403).json({ success: false, message: "⚠️ You must be checked in to request maintenance!" });
        }

    db.query(
        "INSERT INTO maintenance_requests (guest_email, room_number, issue_type, details) VALUES (?, ?, ?, ?)",
        [guestEmail, roomNumber, issueType, details],
        (err, result) => {
            if (err) {
                console.error("❌ Error inserting maintenance request:", err);
                return res.status(500).json({ success: false, message: "Database error occurred." });
            }
            console.log("✅ Maintenance request inserted successfully:", result);
            res.json({ success: true, message: "Maintenance request submitted successfully!" });
        }
    );
});
});
app.get("/guest-maintenance/:guestEmail", (req, res) => {
    const guestEmail = req.params.guestEmail;

    db.query("SELECT * FROM maintenance_requests WHERE guest_email = ?", [guestEmail], (err, result) => {
        if (err) {
            console.error("❌ Error fetching maintenance requests:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }
        res.json(result);
    });
});
app.get("/maintenance-requests", (req, res) => {
    db.query("SELECT * FROM maintenance_requests WHERE request_status != 'Resolved'", (err, result) => {
        if (err) {
            console.error("❌ Error fetching maintenance requests:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }
        console.log("🔍 Maintenance Requests:", result); // Debugging
        res.json(result);
    });
});
app.post("/update-maintenance-status", (req, res) => {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
        return res.status(400).json({ success: false, message: "Missing request ID or status." });
    }

    db.query("UPDATE maintenance_requests SET request_status = ? WHERE id = ?", 
    [status, requestId], (err, result) => {
        if (err) {
            console.error("❌ Error updating maintenance request:", err);
            return res.status(500).json({ success: false, message: "Database error while updating request." });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "Request not found." });
        }

        console.log(`✅ Maintenance request ${requestId} updated to: ${status}`);
        res.json({ success: true, message: `Request updated to ${status}` });
    });
});
app.post("/checkout", (req, res) => {
    const { guestEmail } = req.body;

    if (!guestEmail) {
        return res.status(400).json({ success: false, message: "Guest email is required for checkout." });
    }

    // Find guest's check-in record
    db.query("SELECT guest_id, room_number FROM check_ins INNER JOIN users ON check_ins.guest_id = users.id WHERE users.email = ?", 
    [guestEmail], (err, result) => {
        if (err) {
            console.error("❌ Error fetching check-in record:", err);
            return res.status(500).json({ success: false, message: "Database error." });
        }

        if (result.length === 0) {
            return res.json({ success: false, message: "No active check-in found." });
        }

        const { guest_id, room_number } = result[0];

        // Remove check-in record and make room available again
        db.query("DELETE FROM check_ins WHERE guest_id = ?", [guest_id], (err) => {
            if (err) {
                console.error("❌ Error during checkout:", err);
                return res.status(500).json({ success: false, message: "Database error during checkout." });
            }

            res.json({ success: true, message: `Checkout successful! Room ${room_number} is now available.`, clearSession: true });
        });
    });
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

