require('dotenv').config();

const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const nodemailer = require("nodemailer");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// ✅ Serve static files from the absolute path of "public" (Only fix)
app.use(express.static(path.join(__dirname, "public")));

// New route for guest prediction (Flask API integration)
app.get('/api/guest-prediction', async (req, res) => {
  // Get the 'date' query parameter (should be in YYYY-MM-DD format)
  const { date } = req.query;
  if (!date) {
      return res.status(400).json({ error: 'Date parameter is required (YYYY-MM-DD)' });
  }
  try {
      // Forward the request to the Flask API running on port 5000
      const response = await axios.get(`${process.env.FLASK_API_URL}/predict?date=${date}`);
      res.json(response.data);
  } catch (error) {
      console.error("Error fetching prediction:", error);
      res.status(500).json({ error: 'Error fetching prediction from AI service' });
  }
});


// PostgreSQL Connection (using Neon)
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

// Add this to handle unexpected errors from the PostgreSQL pool
//db.on('error', (err) => {
//  console.error('Unexpected error on idle PostgreSQL client', err);
//});


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

 // ** User Registration **
app.post("/register", async (req, res) => {
    const { email, password, userType } = req.body;
    if (!email || !password || !userType) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }
    try {
        // Check if the user already exists
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (result.rows.length > 0) {
            return res.json({ success: false, message: "User already exists!" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new user into the database
        await db.query(
            "INSERT INTO users (email, password, userType) VALUES ($1, $2, $3)",
            [email, hashedPassword, userType]
        );

        res.json({ success: true, message: "User registered successfully!", redirectTo: "index.html" });

    } catch (error) {
        console.error("Error during registration:", error);
        return res.status(500).json({ success: false, message: "Error processing registration." });
    }
});

// ** User Login with Redirection Logic **
app.post("/login", async (req, res) => {
    const { email, password, userType } = req.body;

    if (!email || !password || !userType) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    try {
        // Query to check user credentials and type
        const result = await db.query("SELECT * FROM users WHERE email = $1 AND userType = $2", [email, userType]);

        if (result.rows.length === 0) {
            return res.json({ success: false, message: "User not found!", redirectTo: "register.html" });
        }

        const user = result.rows[0];

        // Check if password matches
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.json({ success: false, message: "Invalid credentials!" });
        }

        if (userType === "guest") {
            // Check if guest has already checked in
            const checkinResult = await db.query("SELECT * FROM check_ins WHERE guest_id = $1", [user.id]);

            if (checkinResult.rows.length > 0) {
                // Guest already checked in → Redirect to guest services
                return res.json({ success: true, message: "Login successful!", redirectTo: "guest_services.html", email: user.email });
            } else {
                // Guest not checked in → Redirect to check-in page
                return res.json({ success: true, message: "Login successful!", redirectTo: "checkin.html", email: user.email });
            }
        } else {
            // ** Check if staff exists in the staff_roles table **
            const staffResult = await db.query("SELECT * FROM staff_roles WHERE staff_email = $1", [email]);

            if (staffResult.rows.length > 0) {
                const staffRole = staffResult.rows[0].role;

                if (staffRole === "manager") {
                    return res.json({ success: true, message: "Login successful!", redirectTo: "manager_dashboard.html" });
                } else {
                    return res.json({ success: true, message: "Login successful!", redirectTo: "staff_selection.html" });
                }
            } else {
                return res.json({ success: false, message: "Staff not registered in the system!" });
            }
        }
    } catch (error) {
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
      redirectTo = "cleaning_dashboard.html";
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

// Checkout endpoint
app.post("/checkout", (req, res) => {
  const { guestEmail } = req.body;

  if (!guestEmail) {
      return res.status(400).json({ success: false, message: "Guest email is required for checkout." });
  }

  console.log(`🔍 Checking out guest: ${guestEmail}`);

  // Find guest's check-in record
  db.query(
      `SELECT guest_id, room_number FROM check_ins 
       INNER JOIN users ON check_ins.guest_id = users.id 
       WHERE users.email = $1`,
      [guestEmail],
      (err, result) => {
          if (err) {
              console.error("❌ Error fetching check-in record:", err);
              return res.status(500).json({ success: false, message: "Database error." });
          }

          if (result.rows.length === 0) {
              return res.json({ success: false, message: "No active check-in found." });
          }

          const { guest_id, room_number } = result.rows[0];

          console.log(`✅ Guest found. ID: ${guest_id}, Room: ${room_number}`);

          // Delete the guest's orders before checkout
          db.query(
              `DELETE FROM orders WHERE guest_email = (SELECT email FROM users WHERE id = $1)`,
              [guest_id],
              (err) => {
                  if (err) {
                      console.error("❌ Error deleting guest orders:", err);
                      return res.status(500).json({ success: false, message: "Database error while deleting orders." });
                  }

                  console.log("🗑️ Guest orders deleted successfully.");

                  // Delete the guest's cleaning requests before checkout
                  db.query(
                      `DELETE FROM cleaning_requests WHERE guest_email = (SELECT email FROM users WHERE id = $1)`,
                      [guest_id],
                      (err) => {
                          if (err) {
                              console.error("❌ Error deleting cleaning requests:", err);
                              return res.status(500).json({ success: false, message: "Database error while deleting cleaning requests." });
                          }

                          console.log("🗑️ Guest cleaning requests deleted successfully.");

                          // ✅ **NEW: Delete maintenance requests before checkout**
                          db.query(
                              `DELETE FROM maintenance_requests WHERE guest_email = (SELECT email FROM users WHERE id = $1)`,
                              [guest_id],
                              (err) => {
                                  if (err) {
                                      console.error("❌ Error deleting maintenance requests:", err);
                                      return res.status(500).json({ success: false, message: "Database error while deleting maintenance requests." });
                                  }

                                  console.log("🗑️ Guest maintenance requests deleted successfully.");

                                  // Remove check-in record and make room available again
                                  db.query(
                                      `DELETE FROM check_ins WHERE guest_id = $1`,
                                      [guest_id],
                                      (err) => {
                                          if (err) {
                                              console.error("❌ Error during checkout:", err);
                                              return res.status(500).json({ success: false, message: "Database error during checkout." });
                                          }

                                          console.log(`✅ Checkout successful! Room ${room_number} is now available.`);

                                          res.json({
                                              success: true,
                                              message: `Checkout successful! Room ${room_number} is now available.`,
                                              clearSession: true
                                          });
                                      }
                                  );
                              }
                          );
                      }
                  );
              }
          );
      }
  );
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

// Route to get available cleaning slots
app.get("/available-cleaning-slots", (req, res) => {
    // SQL query to fetch available cleaning time slots
    db.query("SELECT time_slot FROM cleaning_times WHERE available = TRUE", (err, result) => {
        if (err) {
            console.error("❌ Error fetching cleaning time slots:", err);
            return res.status(500).json({ message: "Server error" });
        }

        console.log("Results from DB:", result.rows);

        // Check if we have any available cleaning time slots
        if (result.rows.length > 0) {
            res.json(result.rows.map(row => row.time_slot));  // Map to just return the time_slot values
        } else {
            res.status(404).json({ message: "No available time slots." });
        }
    });
});

// Request cleaning route (POST)
app.post("/request-cleaning", async (req, res) => {
    const { guestEmail, roomNumber, timeSlot } = req.body;

    if (!guestEmail || !roomNumber || !timeSlot) {
        return res.status(400).json({ success: false, message: "Missing required parameters." });
    }

    try {
        // Start a transaction to handle both operations (insert and update)
        await db.query('BEGIN');  // Start the transaction

        // Insert cleaning request into the database
        await db.query(
            "INSERT INTO cleaning_requests (guest_email, room_number, time_slot) VALUES ($1, $2, $3)",
            [guestEmail, roomNumber, timeSlot]
        );

        // Update the availability of the time slot
        await db.query(
            "UPDATE cleaning_times SET available = FALSE WHERE time_slot = $1",
            [timeSlot]
        );

        // Commit the transaction
        await db.query('COMMIT');

        // Respond once all operations are complete
        res.json({ success: true, message: "Cleaning request submitted successfully." });
    } catch (error) {
        console.error("Error submitting cleaning request:", error);
        await db.query('ROLLBACK');  // Rollback the transaction on error
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// Book the first available cleaning slot and mark it as unavailable
app.get("/first-available-cleaning", async (req, res) => {
  const { guestEmail, roomNumber } = req.query;

  if (!guestEmail || !roomNumber) {
      console.log("❌ Error: Missing guestEmail or roomNumber");
      return res.status(400).json({ success: false, message: "Missing guestEmail or roomNumber" });
  }

  console.log("🔍 Fetching first available cleaning slot...");

  try {
      // Start transaction
      await db.query('BEGIN');

      // Fetch first available slot
      const result = await db.query(
          "SELECT time_slot FROM cleaning_times WHERE available = TRUE LIMIT 1"
      );

      if (result.rows.length === 0) {
          console.log("⚠️ No available slots found.");
          await db.query('ROLLBACK');
          return res.json({ success: false, message: "No available slots found." });
      }

      let timeSlot = result.rows[0].time_slot.trim();
      console.log("✅ Found available time slot:", timeSlot);

      // Mark the slot as unavailable
      const updateResult = await db.query(
          "UPDATE cleaning_times SET available = FALSE WHERE time_slot = $1 RETURNING *",
          [timeSlot]
      );
      console.log("🔄 Updated slot:", updateResult.rows);

      // Insert cleaning request
      const insertResult = await db.query(
          "INSERT INTO cleaning_requests (guest_email, room_number, time_slot) VALUES ($1, $2, $3) RETURNING *",
          [guestEmail, roomNumber, timeSlot]
      );
      console.log("📝 Inserted cleaning request:", insertResult.rows);

      // Commit transaction
      await db.query('COMMIT');

      res.json({ success: true, timeSlot, guestEmail, roomNumber });
  } catch (error) {
      console.error("❌ Error processing request:", error);
      await db.query('ROLLBACK');
      res.status(500).json({ success: false, message: "Server error" });
  }
});


// Check cleaning request status
app.get("/guest-cleaning/:guestEmail", async (req, res) => {
    const { guestEmail } = req.params;
    console.log("Results from DB3:", guestEmail);
    
    try {
        // Query to get cleaning requests for the guest
        const result = await db.query(
            "SELECT room_number, time_slot, request_status FROM cleaning_requests WHERE guest_email = $1",
            [guestEmail]
        );
        
        console.log("Results from DB2:", result.rows);
        return res.json(result.rows); // ✅ Send results from the database
    } catch (err) {
        console.error("❌ Error fetching cleaning requests:", err);
        return res.status(500).json({ message: "Server error" });
    }
});

// Update cleaning request status
app.post("/update-cleaning-status", async (req, res) => {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
        return res.status(400).json({ success: false, message: "Missing request ID or status." });
    }

    try {
        // Update the cleaning request status
        const result = await db.query(
            "UPDATE cleaning_requests SET request_status = $1 WHERE id = $2",
            [status, requestId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Cleaning request not found." });
        }

        console.log(`✅ Cleaning request ${requestId} updated to: ${status}`);
        return res.json({ success: true, message: `Cleaning request updated to ${status}` });
    } catch (err) {
        console.error("❌ Error updating cleaning request:", err);
        return res.status(500).json({ success: false, message: "Database error while updating request." });
    }
});

// Get all cleaning requests that are not completed
app.get("/cleaning-requests", async (req, res) => {
    try {
        // Query to get all cleaning requests with status other than 'Completed'
        const result = await db.query(
            "SELECT * FROM cleaning_requests WHERE request_status != 'Completed'"
        );

        console.log("🔍 Cleaning Requests:", result.rows); // Debugging
        res.json(result.rows); // ✅ Send cleaning requests
    } catch (err) {
        console.error("❌ Error fetching cleaning requests:", err);
        return res.status(500).json({ success: false, message: "Database error." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
