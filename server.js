require('dotenv').config();

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(express.static("public"));

// PostgreSQL Connection (using Neon)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

// Connect to PostgreSQL
db.connect((err) => {
  if (err) {
    console.error("❌ PostgreSQL Connection Failed:", err);
    process.exit(1);
  } else {
    console.log("✅ PostgreSQL Connected to Neon Database");
  }
});

// ** Serve index.html as default page **
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ** User Registration (PostgreSQL Syntax) **
app.post("/register", async (req, res) => {
  const { email, password, userType } = req.body;
  if (!email || !password || !userType) {
    return res.status(400).json({ success: false, message: "Please provide all required fields." });
  }
  try {
    const userExists = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userExists.rows.length > 0) {
      return res.json({ success: false, message: "User already exists!" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (email, password, userType) VALUES ($1, $2, $3)",
      [email, hashedPassword, userType]
    );
    res.json({ success: true, message: "User registered successfully!", redirectTo: "index.html" });
  } catch (error) {
    console.error("Error registering user:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** User Login with Redirection Logic **
app.post("/login", async (req, res) => {
  const { email, password, userType } = req.body;
  if (!email || !password || !userType) {
    return res.status(400).json({ success: false, message: "Please provide all required fields." });
  }
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1 AND userType = $2", [email, userType]);
    if (result.rows.length === 0) {
      return res.json({ success: false, message: "User not found!", redirectTo: "register.html" });
    }
    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials!" });
    }
    if (userType === "guest") {
      const checkinResult = await db.query("SELECT * FROM check_ins WHERE guest_id = $1", [user.id]);
      if (checkinResult.rows.length > 0) {
        return res.json({ success: true, message: "Login successful!", redirectTo: "guest_services.html", email: user.email });
      } else {
        return res.json({ success: true, message: "Login successful!", redirectTo: "checkin.html", email: user.email });
      }
    } else {
      const staffResult = await db.query("SELECT * FROM staff_roles WHERE staff_email = $1", [email]);
      if (staffResult.rows.length > 0) {
        return res.json({ success: true, message: "Login successful!", redirectTo: "staff_selection.html" });
      } else {
        return res.json({ success: false, message: "Staff not registered in the system!" });
      }
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({ success: false, message: "Server error during login." });
  }
});

// ** Available Rooms **
app.get("/available-rooms", async (req, res) => {
  try {
    const result = await db.query("SELECT room_number FROM rooms WHERE room_number NOT IN (SELECT room_number FROM check_ins)");
    res.json(result.rows);
  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** Guest Check-In (Now Redirects Directly to Guest Services) **
app.post("/checkin", async (req, res) => {
  const { guestEmail, roomNumber, nights } = req.body;
  if (!guestEmail || !roomNumber || !nights) {
    return res.status(400).json({ success: false, message: "Please provide all required fields." });
  }
  try {
    const userResult = await db.query("SELECT id FROM users WHERE email = $1 AND userType = 'guest'", [guestEmail]);
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: "Guest not registered! Please register first." });
    }
    const guestId = userResult.rows[0].id;
    const roomResult = await db.query("SELECT * FROM check_ins WHERE room_number = $1", [roomNumber]);
    if (roomResult.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Room already booked! Choose another room." });
    }
    await db.query("INSERT INTO check_ins (guest_id, room_number, nights) VALUES ($1, $2, $3)", [guestId, roomNumber, nights]);
    res.json({ success: true, message: "Check-in successful!", redirectTo: "guest_services.html" });
  } catch (error) {
    console.error("Error during check-in:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** Place Food Order (Multiple Items) **
app.post("/place-order", async (req, res) => {
  const { guestEmail, orderItems } = req.body;
  if (!guestEmail || !orderItems || orderItems.length === 0) {
    return res.status(400).json({ success: false, message: "Invalid order request." });
  }
  try {
    let totalAmount = 0;
    for (let item of orderItems) {
      totalAmount += item.price * item.quantity;
      await db.query(
        "INSERT INTO orders (guest_email, menu_item, quantity, total_price, order_status) VALUES ($1, $2, $3, $4, 'Pending')",
        [guestEmail, item.name, item.quantity, item.price * item.quantity]
      );
    }
    res.json({ success: true, message: "Order placed successfully!", totalAmount });
  } catch (error) {
    console.error("Error placing order:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** Check Guest's Order Status **
app.get("/check-order/:guestEmail", async (req, res) => {
  const guestEmail = req.params.guestEmail;
  try {
    const result = await db.query("SELECT * FROM orders WHERE guest_email = $1 ORDER BY order_time DESC", [guestEmail]);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Order Status Fetch Error:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

app.post("/select-role", async (req, res) => {
  const { email, role } = req.body;

  if (!email || !role) {
    return res.status(400).json({ success: false, message: "Please enter your email and select a role." });
  }

  try {
    // Check if the staff email and role exist in the staff_roles table
    const staffCheck = await db.query(
      "SELECT * FROM staff_roles WHERE staff_email = $1 AND role = $2",
      [email, role]
    );

    if (staffCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "Invalid role selection or staff not registered." });
    }

    // Redirect to the appropriate dashboard
    let redirectTo = "";
    if (role === "cook") {
      redirectTo = "cook_dashboard.html";
    } else if (role === "maintenance") {
      redirectTo = "maintenance_dashboard.html";
    } else if (role === "cleaner") {
      redirectTo = "cleaner_dashboard.html";
    }

    return res.json({
      success: true,
      message: "Role selected successfully!",
      redirectTo,
    });
  } catch (error) {
    console.error("Error selecting role:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});


// ** Update Order Status (Staff) **
app.post("/update-order-status", async (req, res) => {
  const { orderId, status } = req.body;
  if (!orderId || !status) {
    return res.status(400).json({ success: false, message: "Invalid request. Missing order ID or status." });
  }
  try {
    const result = await db.query("UPDATE orders SET order_status = $1 WHERE id = $2", [status, orderId]);
    console.log(`✅ Order ${orderId} updated to: ${status}`);
    res.json({ success: true, message: `Order updated to ${status}` });
  } catch (error) {
    console.error("❌ Order Status Update Error:", error);
    return res.status(500).json({ success: false, message: "Database error occurred while updating order status." });
  }
});

// ** Cook - Fetch Orders **
app.get("/cook/orders", async (req, res) => {
  try {
    const result = await db.query("SELECT id, guest_email, menu_item, quantity, order_status FROM orders WHERE order_status != 'Completed'");
    console.log("🔍 Orders fetched for cook dashboard:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching orders:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** Cook - Update Order Status **
app.post("/cook/update-order", async (req, res) => {
  const { orderId, status } = req.body;
  if (!orderId || !status) {
    return res.status(400).json({ success: false, message: "Missing order ID or status." });
  }
  try {
    const result = await db.query("UPDATE orders SET order_status = $1 WHERE id = $2", [status, orderId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }
    res.json({ success: true, message: `Order #${orderId} updated to ${status}` });
  } catch (error) {
    console.error("❌ Order Status Update Error:", error);
    return res.status(500).json({ success: false, message: "Database error while updating order status." });
  }
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

app.get("/staff_selection.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "staff_selection.html"));
});

app.get("/staff_dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "staff_dashboard.html"));
});

app.get("/order_food.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "order_food.html"));
});

app.get("/cook_dashboard.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cook_dashboard.html"));
});

// ** Get the Guest's Room Number **
app.get("/guest-room/:guestEmail", async (req, res) => {
  const guestEmail = req.params.guestEmail;
  try {
    const result = await db.query(
      "SELECT room_number FROM check_ins INNER JOIN users ON check_ins.guest_id = users.id WHERE users.email = $1",
      [guestEmail]
    );
    if (result.rows.length > 0) {
      res.json({ success: true, room_number: result.rows[0].room_number });
    } else {
      res.json({ success: false, message: "No active check-in found for this guest." });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

// ** Handle Maintenance Request Submission **
app.post("/request-maintenance", async (req, res) => {
  const { guestEmail, roomNumber, issueType, details } = req.body;
  console.log("Received Maintenance Request:", req.body);
  if (!guestEmail || !roomNumber || !issueType) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }
  try {
    const result = await db.query(
      "SELECT * FROM check_ins WHERE guest_id = (SELECT id FROM users WHERE email = $1 AND userType = 'guest')",
      [guestEmail]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ success: false, message: "⚠️ You must be checked in to request maintenance!" });
    }
    const insertResult = await db.query(
      "INSERT INTO maintenance_requests (guest_email, room_number, issue_type, details) VALUES ($1, $2, $3, $4)",
      [guestEmail, roomNumber, issueType, details]
    );
    console.log("✅ Maintenance request inserted successfully:", insertResult);
    res.json({ success: true, message: "Maintenance request submitted successfully!" });
  } catch (error) {
    console.error("Error during maintenance request:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});

app.get("/guest-maintenance/:guestEmail", async (req, res) => {
  const guestEmail = req.params.guestEmail;
  try {
    const result = await db.query("SELECT * FROM maintenance_requests WHERE guest_email = $1", [guestEmail]);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching maintenance requests:", error);
    return res.status(500).json({ success: false, message: "Database error." });
  }
});

app.get("/maintenance-requests", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM maintenance_requests WHERE request_status != 'Resolved'");
    console.log("🔍 Maintenance Requests:", result.rows);
    res.json(result.rows);
  } catch (error) {
    console.error("❌ Error fetching maintenance requests:", error);
    return res.status(500).json({ success: false, message: "Database error." });
  }
});

app.post("/update-maintenance-status", async (req, res) => {
  const { requestId, status } = req.body;
  if (!requestId || !status) {
    return res.status(400).json({ success: false, message: "Missing request ID or status." });
  }
  try {
    const result = await db.query("UPDATE maintenance_requests SET request_status = $1 WHERE id = $2", [status, requestId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Request not found." });
    }
    console.log(`✅ Maintenance request ${requestId} updated to: ${status}`);
    res.json({ success: true, message: `Request updated to ${status}` });
  } catch (error) {
    console.error("❌ Error updating maintenance request:", error);
    return res.status(500).json({ success: false, message: "Database error while updating request." });
  }
});

app.post("/checkout", async (req, res) => {
  const { guestEmail } = req.body;
  if (!guestEmail) {
    return res.status(400).json({ success: false, message: "Guest email is required for checkout." });
  }
  try {
    const result = await db.query("DELETE FROM check_ins WHERE guest_id = (SELECT id FROM users WHERE email = $1)", [guestEmail]);
    res.json({ success: true, message: "Checkout successful!" });
  } catch (error) {
    console.error("Error during checkout:", error);
    return res.status(500).json({ success: false, message: "Database error occurred." });
  }
});
app.get("/menu", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM menu");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching menu:", error);
    res.status(500).json({ success: false, message: "Database error occurred." });
  }
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
