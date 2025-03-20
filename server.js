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

app.get('/api/demand_prediction', async (req, res) => {
  try {
    const { year, month, day_of_week, is_weekend, is_holiday_season, avg_lead_time, sum_previous_bookings, avg_adr, total_children } = req.query;

    // Make sure all parameters are provided
    if (!year || !month || !day_of_week || !is_weekend || !is_holiday_season || !avg_lead_time || !sum_previous_bookings || !avg_adr || !total_children) {
      return res.status(400).json({ error: 'Missing required parameters for demand prediction.' });
    }

    // Construct the Railway API URL
    const apiUrl = `https://web-production-f430d.up.railway.app/api/demand_prediction?year=${year}&month=${month}&day_of_week=${day_of_week}&is_weekend=${is_weekend}&is_holiday_season=${is_holiday_season}&avg_lead_time=${avg_lead_time}&sum_previous_bookings=${sum_previous_bookings}&avg_adr=${avg_adr}&total_children=${total_children}`;

    // Fetch data from the Railway API
    const response = await axios.get(apiUrl);
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching data from Railway API:', error);
    res.status(500).json({ error: 'Error fetching data from Railway API' });
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


app.post("/login", async (req, res) => {
    let { email, password, userType } = req.body;

  // If the email is manager's email and userType is "staff", treat it as "manager"
    if (email === "manager@gmail.com" && userType === "staff") {
        userType = "manager";
    }

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
            // ** Check if the user is a manager or staff**
            if (userType === "manager") {
                // Direct manager login
                return res.json({ success: true, message: "Login successful!", redirectTo: "manager_dashboard.html" });
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
app.post("/checkin", (req, res) => {
    const { guestEmail, roomNumber, nights } = req.body;

    if (!guestEmail || !roomNumber || !nights) {
        return res.status(400).json({ success: false, message: "Please provide all required fields." });
    }

    // Check if the guest exists
    db.query("SELECT id FROM users WHERE email = $1 AND userType = 'guest'", [guestEmail], (err, result) => {
        if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

        if (result.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Guest not registered! Please register first." });
        }

        const guestId = result.rows[0].id;

        // Check if the room is already booked
        db.query("SELECT * FROM check_ins WHERE room_number = $1", [roomNumber], (err, roomResult) => {
            if (err) return res.status(500).json({ success: false, message: "Database error occurred." });

            if (roomResult.rows.length > 0) {
                return res.status(400).json({ success: false, message: "Room already booked! Choose another room." });
            }

            // Insert check-in information into the database
            db.query("INSERT INTO check_ins (guest_id, room_number, nights) VALUES ($1, $2, $3)", [guestId, roomNumber, nights], (err) => {
                if (err) return res.status(500).json({ success: false, message: "Error processing check-in." });

                // Send check-in email using nodemailer
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: 'hoteloncall55@gmail.com',
                        pass: 'fvwujhuikywpgibi'
                    }
                });

                const mailOptions = {
                    from: 'hoteloncall55@gmail.com',
                    to: guestEmail,
                    subject: 'Welcome to Our Luxury Hotel',
                    text: `Dear Valued Guest,
                    
                    We are delighted to welcome you to our distinguished sanctuary of luxury. As you arrive, our dedicated concierge team awaits to ensure your check-in is as seamless as it is exquisite. Every detail of your stay—from your elegantly appointed room to our refined amenities—has been curated with your comfort and pleasure in mind. We look forward to providing you with an unforgettable experience that truly reflects the pinnacle of hospitality.
                    
                    Warm regards,
                    HotelOnCall Team`
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("Error sending check-in email:", error);
                    } else {
                        console.log("Check-in email sent:", info.response);
                    }
                    res.json({ success: true, message: "Check-in successful!", redirectTo: "guest_services.html" });
                });
            });
        });
    });
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
app.post("/cook/update-order", (req, res) => {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
        return res.status(400).json({ success: false, message: "Missing order ID or status." });
    }

    const sqlUpdate = "UPDATE orders SET order_status = $1 WHERE id = $2";

    db.query(sqlUpdate, [status, orderId], (err, result) => {
        if (err) {
            console.error("❌ Order Status Update Error:", err);
            return res.status(500).json({ success: false, message: "Database error while updating order status." });
        }
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Order not found." });
        }

        // Insert email sending logic if status is the trigger status
        if (status === "Completed") {
            const sqlSelect = "SELECT guest_email FROM orders WHERE id = $1";

            db.query(sqlSelect, [orderId], (err, rows) => {
                if (!err && rows.rowCount > 0) {
                    const guestEmail = rows.rows[0].guest_email;
                    const nodemailer = require('nodemailer');

                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'hoteloncall55@gmail.com',      
                            pass: 'fvwujhuikywpgibi'
                        }
                    });

                    const mailOptions = {
                        from: 'hoteloncall55@gmail.com',
                        to: guestEmail,
                        subject: 'Your Order is Completed',
                        text: 'Hello, your order has been completed. Thank you for your patience!'
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Error sending order completion email:", error);
                        } else {
                            console.log("Order completion email sent:", info.response);
                        }
                    });
                }
            });
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

// ** Update Maintenance Request Status **
app.post("/update-maintenance-status", (req, res) => {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
        return res.status(400).json({ success: false, message: "Missing request ID or status." });
    }

    // Update the maintenance request status in PostgreSQL
    db.query("UPDATE maintenance_requests SET request_status = $1 WHERE id = $2", 
    [status, requestId], (err, result) => {
        if (err) {
            console.error("❌ Error updating maintenance request:", err);
            return res.status(500).json({ success: false, message: "Database error while updating request." });
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Request not found." });
        }

        console.log(`✅ Maintenance request ${requestId} updated to: ${status}`);
        res.json({ success: true, message: `Request updated to ${status}` });

        // Send email if the request is marked as "Resolved"
        if (status === "Resolved") {
            db.query("SELECT guest_email FROM maintenance_requests WHERE id = $1", [requestId], (err, rows) => {
                if (!err && rows.rowCount > 0) {
                    const guestEmail = rows.rows[0].guest_email;
                    const nodemailer = require('nodemailer');
                    const transporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: 'hoteloncall55@gmail.com',      
                            pass: 'fvwujhuikywpgibi'
                        }
                    });
                    const mailOptions = {
                        from: 'hoteloncall55@gmail.com',
                        to: guestEmail,
                        subject: 'Your Maintenance Request is Completed',
                        text: 'Hello, your maintenance request has been completed. Thank you for your patience!'
                    };

                    transporter.sendMail(mailOptions, (error, info) => {
                        if (error) {
                            console.error("Error sending maintenance completion email:", error);
                        } else {
                            console.log("Maintenance completion email sent:", info.response);
                        }
                    });
                }
            });
        }
    });
});


app.post("/checkout", async (req, res) => {
    const { guestEmail, feedback } = req.body;

    if (!guestEmail) {
        console.error("❌ No guest email provided");
        return res.status(400).json({ success: false, message: "Guest email is required for checkout." });
    }

    console.log(`🔍 Guest Email: ${guestEmail}`);

    try {
        // Find guest's check-in record
        const guestCheckInResult = await db.query(
            "SELECT guest_id, room_number FROM check_ins INNER JOIN users ON check_ins.guest_id = users.id WHERE users.email = $1",
            [guestEmail]
        );

        if (guestCheckInResult.rowCount === 0) {
            console.error(`❌ No active check-in found for guest email: ${guestEmail}`);
            return res.json({ success: false, message: "No active check-in found." });
        }

        const { guest_id, room_number } = guestCheckInResult.rows[0];
        console.log(`Guest found: guest_id = ${guest_id}, room_number = ${room_number}`);

        // Fetch cleaning requests to get the time slots
        const cleaningRequestResult = await db.query(
            "SELECT time_slot FROM cleaning_requests WHERE guest_email = (SELECT email FROM users WHERE id = $1)",
            [guest_id]
        );

        // Only update cleaning times if there are cleaning requests
        if (cleaningRequestResult.rowCount > 0) {
            const timeSlots = cleaningRequestResult.rows.map(row => row.time_slot);
            console.log("Time Slots to be updated:", timeSlots);

            // Make cleaning time slots available before deleting cleaning requests
            await db.query(
                `UPDATE cleaning_times SET available = TRUE WHERE time_slot = ANY($1)`,
                [timeSlots]
            );
            console.log("✅ Cleaning times updated successfully.");
        } else {
            console.log("❌ No cleaning requests found, skipping cleaning times update.");
        }

        // Delete the guest's orders before checkout
        await db.query("DELETE FROM orders WHERE guest_email = (SELECT email FROM users WHERE id = $1)", [guest_id]);

        // Delete the guest's cleaning requests before checkout
        await db.query("DELETE FROM cleaning_requests WHERE guest_email = (SELECT email FROM users WHERE id = $1)", [guest_id]);

        // Delete the guest's maintenance requests before checkout
        await db.query("DELETE FROM maintenance_requests WHERE guest_email = (SELECT email FROM users WHERE id = $1)", [guest_id]);

        // Insert checkout record into the checkouts table
        const checkoutTime = new Date();
        await db.query(
            "INSERT INTO checkouts (guest_id, room_number, checkout_time, feedback) VALUES ($1, $2, $3, $4)",
            [guest_id, room_number, checkoutTime, feedback || null]
        );

        // Remove check-in record and make room available again
        await db.query("DELETE FROM check_ins WHERE guest_id = $1", [guest_id]);

        // Send thank you email to the guest
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'hoteloncall55@gmail.com',
                pass: 'fvwujhuikywpgibi'
            }
        });

        const mailOptions = {
            from: 'hoteloncall55@gmail.com',
            to: guestEmail,
            subject: 'Thank You for Staying With Us',
            text: `Dear Esteemed Guest,
            Thank you for choosing to spend your time with us at our luxurious retreat. As you prepare for departure, we trust that your stay was as memorable as it was indulgent. Our team is here to ensure that your check-out is smooth and effortless, while we take great pride in having served you with the highest level of excellence. We sincerely hope that the experience and memories created during your visit will beckon you back in the near future.
            Warm regards,
            HotelOnCall Team`
        };

        await transporter.sendMail(mailOptions);
        console.log("✅ Checkout email sent successfully.");

        // Respond to the client
        res.json({
            success: true,
            message: `Checkout successful! Room ${room_number} is now available.`,
            clearSession: true
        });
    } catch (err) {
        console.error("❌ Error during checkout:", err);
        res.status(500).json({ success: false, message: "Database error during checkout." });
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

// Route to get available cleaning slots
app.get("/available-cleaning-slots", (req, res) => {
    // SQL query to fetch available cleaning time slots and order them by time
    db.query("SELECT time_slot FROM cleaning_times WHERE available = TRUE ORDER BY time_slot ASC", (err, result) => {
        if (err) {
            console.error("❌ Error fetching cleaning time slots:", err);
            return res.status(500).json({ message: "Server error" });
        }

        console.log("Results from DB:", result.rows);

        // Check if we have any available cleaning time slots
        if (result.rows.length > 0) {
            // Return the time_slot values in ascending order
            res.json(result.rows.map(row => row.time_slot));
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

    console.log("🔍 Fetching available cleaning slots...");

    try {
        // Start transaction
        await db.query('BEGIN');

        // Fetch all available slots
        const result = await db.query(
            "SELECT time_slot FROM cleaning_times WHERE available = TRUE"
        );

        if (result.rows.length === 0) {
            console.log("⚠️ No available slots found.");
            await db.query('ROLLBACK');
            return res.json({ success: false, message: "No available slots found." });
        }

        // Sort the slots (AM before PM, and order by time)
        let slots = result.rows.map(row => row.time_slot.trim());
        slots.sort((a, b) => {
            const timeA = a.split(' ');
            const timeB = b.split(' ');

            if (timeA[1] === 'AM' && timeB[1] === 'PM') return -1;
            if (timeA[1] === 'PM' && timeB[1] === 'AM') return 1;
            return new Date('1970-01-01T' + timeA[0]) - new Date('1970-01-01T' + timeB[0]);
        });

        // Select the first available time slot
        const timeSlot = slots[0];
        console.log("✅ First available time slot:", timeSlot);

        // Mark the selected slot as unavailable
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


app.post("/update-cleaning-status", async (req, res) => {
    const { requestId, status } = req.body;

    if (!requestId || !status) {
        return res.status(400).json({ success: false, message: "Missing request ID or status." });
    }

    try {
        // Update cleaning request status in the database
        const result = await db.query(
            "UPDATE cleaning_requests SET request_status = $1 WHERE id = $2 RETURNING guest_email",
            [status, requestId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Cleaning request not found." });
        }

        console.log(`✅ Cleaning request ${requestId} updated to: ${status}`);

        if (status === "Completed") {
            const guestEmail = result.rows[0]?.guest_email;

            if (guestEmail) {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: "hoteloncall55@gmail.com",
                        pass: "fvwujhuikywpgibi",
                    },
                });

                const mailOptions = {
                    from: "hoteloncall55@gmail.com",
                    to: guestEmail,
                    subject: "Your Cleaning Request is Completed",
                    text: "Hello, your cleaning request has been completed. We hope you enjoy the refreshed environment!",
                };

                transporter.sendMail(mailOptions, (error, info) => {
                    if (error) {
                        console.error("Error sending cleaning completion email:", error);
                    } else {
                        console.log("Cleaning completion email sent:", info.response);
                    }
                });
            }
        }

        res.json({ success: true, message: `Cleaning request updated to ${status}` });

    } catch (err) {
        console.error("❌ Database error while updating request:", err);
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


app.post('/send-verification-code', async (req, res) => {
    const { email } = req.body;
    
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000); // Generates a 6-digit code
    const expiresAt = new Date(Date.now() + 15 * 60000); // Expiration time: 15 minutes from now

    try {
        // Save the code temporarily in the database
        await db.query(
            'INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)', 
            [email, verificationCode, expiresAt]
        );

        // Setup Nodemailer to send the email
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'hoteloncall55@gmail.com',
                pass: 'fvwujhuikywpgibi'
            }
        });

        const mailOptions = {
            from: 'hoteloncall55@gmail.com',
            to: email,
            subject: 'Password Reset Verification Code',
            text: `Your verification code is: ${verificationCode}`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error("❌ Error sending email:", error);
                return res.status(500).json({ message: 'Error sending email' });
            }
            res.json({ message: 'Verification code sent to your email!', redirectTo: '/reset_password.html' });
        });

    } catch (err) {
        console.error("❌ Error saving verification code:", err);
        return res.status(500).json({ message: 'Database error while saving verification code' });
    }
});



app.post('/reset-password', async (req, res) => {
    const { email, verificationCode, newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ message: 'Passwords do not match' });
    }

    try {
        // Verify the code from the database
        const codeResult = await db.query(
            'SELECT * FROM verification_codes WHERE email = $1 AND code = $2',
            [email, verificationCode]
        );

        if (codeResult.rowCount === 0) {
            return res.status(400).json({ message: 'Invalid verification code' });
        }

        // Hash the new password using bcrypt
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        await db.query(
            'UPDATE users SET password = $1 WHERE email = $2',
            [hashedPassword, email]
        );

        // Optionally, delete the verification code after it's used
        await db.query(
            'DELETE FROM verification_codes WHERE email = $1',
            [email]
        );

        res.json({ message: 'Password successfully updated', redirectTo: '/index.html' });

    } catch (err) {
        console.error("❌ Error resetting password:", err);
        return res.status(500).json({ message: 'Server error while resetting password' });
    }
});


app.get('/api/feedback', async (req, res) => {
    const query = `
        SELECT 
            checkouts.room_number, 
            users.email, 
            checkouts.feedback, 
            checkouts.checkout_time 
        FROM checkouts
        INNER JOIN users ON checkouts.guest_id = users.id
        ORDER BY checkouts.checkout_time DESC;
    `;

    try {
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.get('/api/task-completion', async (req, res) => {
    const queries = {
        cleaning: `SELECT COUNT(*) AS total, SUM(CASE WHEN request_status = 'Completed' THEN 1 ELSE 0 END) AS done FROM cleaning_requests`,
        cooking: `SELECT COUNT(*) AS total, SUM(CASE WHEN order_status = 'Completed' THEN 1 ELSE 0 END) AS done FROM orders`,
        maintenance: `SELECT COUNT(*) AS total, SUM(CASE WHEN request_status = 'Resolved' THEN 1 ELSE 0 END) AS done FROM maintenance_requests`
    };

    try {
        let results = {};

        for (const key of Object.keys(queries)) {
            const data = await db.query(queries[key]);
            const total = parseInt(data.rows[0].total) || 1;
            const done = parseInt(data.rows[0].done) || 0;
            results[key] = total > 0 ? Math.round((done / total) * 100) : 0;
        }

        console.log("Task Completion Results:", results);
        res.json(results);

    } catch (err) {
        console.error("❌ Error fetching task completion data:", err);
        res.status(500).json({ success: false, message: "Database error." });
    }
});



app.get("/calculate-bill/:roomNumber", async (req, res) => {
    const roomNumber = req.params.roomNumber;
    const query = `
      SELECT 
        c.room_number,
        c.nights,
        (c.nights * 250) AS room_charge,
        COALESCE(SUM(o.total_price), 0) AS food_charge,
        ((c.nights * 250) + COALESCE(SUM(o.total_price), 0)) AS total_bill
      FROM check_ins c
      LEFT JOIN users u ON c.guest_id = u.id
      LEFT JOIN orders o ON u.email = o.guest_email
      WHERE c.room_number = $1
      GROUP BY c.id
    `;

    try {
        const result = await db.query(query, [roomNumber]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "No active check-in found for that room" });
        }

        // Return the total bill in cents (Stripe expects amounts in cents)
        const totalBillCents = Math.round(result.rows[0].total_bill * 100);
        res.json({ success: true, totalBillCents });

    } catch (err) {
        console.error("❌ Error calculating bill:", err);
        return res.status(500).json({ success: false, message: "Error calculating bill" });
    }
});


app.post("/create-checkout-session", async (req, res) => {
    const { roomNumber } = req.body;
    if (!roomNumber) {
      return res.status(400).json({ success: false, message: "Room number is required" });
    }
    
    // Calculate total charges using your database schema
    const query = `
      SELECT 
        c.room_number,
        c.nights,
        (c.nights * 250) AS room_charge,
        COALESCE(SUM(o.total_price), 0) AS food_charge,
        (SELECT COUNT(*) FROM cleaning_requests cr WHERE cr.guest_email = u.email) * 30 AS cleaning_charge,
        (SELECT COUNT(*) FROM maintenance_requests mr WHERE mr.guest_email = u.email) * 50 AS maintenance_charge,
        (
          (c.nights * 250) 
          + COALESCE(SUM(o.total_price), 0)
          + (SELECT COUNT(*) FROM cleaning_requests cr WHERE cr.guest_email = u.email) * 30
          + (SELECT COUNT(*) FROM maintenance_requests mr WHERE mr.guest_email = u.email) * 50
        ) AS total_bill
      FROM check_ins c
      LEFT JOIN users u ON c.guest_id = u.id
      LEFT JOIN orders o ON u.email = o.guest_email
      WHERE c.room_number = $1
      GROUP BY c.id, u.email;
    `;
    
    try {
        const { rows } = await db.query(query, [roomNumber]);
        
        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "No active check-in found for that room" });
        }
        
        // Destructure the charges from the query result
        const { room_charge, food_charge, cleaning_charge, maintenance_charge, nights } = rows[0];
        
        // Debug: Print out each charge in the terminal
        console.log("DEBUG: Room Charge:", room_charge);
        console.log("DEBUG: Food Charge:", food_charge);
        console.log("DEBUG: Cleaning Charge:", cleaning_charge);
        console.log("DEBUG: Maintenance Charge:", maintenance_charge);
        
        // Convert amounts to cents for Stripe (multiply by 100)
        const roomChargeCents = Math.round(room_charge * 100);
        const foodChargeCents = Math.round(food_charge * 100);
        const cleaningChargeCents = Math.round(cleaning_charge * 100);
        const maintenanceChargeCents = Math.round(maintenance_charge * 100);
        
        // Create Stripe session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `Room Charge for Room ${roomNumber} (${nights} night(s))`,
                        },
                        unit_amount: roomChargeCents,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: "Food Charge",
                        },
                        unit_amount: foodChargeCents,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: "Cleaning Charge",
                        },
                        unit_amount: cleaningChargeCents,
                    },
                    quantity: 1,
                },
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: "Maintenance Charge",
                        },
                        unit_amount: maintenanceChargeCents,
                    },
                    quantity: 1,
                }
            ],
            mode: 'payment',
            // Update these URLs according to your environment (localhost or production)
            success_url: 'https://hotel-on-call.vercel.app/payment_success.html?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://hotel-on-call.vercel.app/checkout.html',
        });
        
        res.json({ success: true, sessionId: session.id, url: session.url });
    } catch (err) {
        console.error("Stripe Checkout Session Error:", err);
        res.status(500).json({ success: false, message: "Stripe Checkout Session Error" });
    }
});


app.post("/finalize-checkout", express.json(), async (req, res) => {
    const { guestEmail } = req.body;
    if (!guestEmail) {
      return res.status(400).json({ success: false, message: "Missing guest email." });
    }
  
    try {
      // First, retrieve the guest's id from the users table
      const query = "SELECT id FROM users WHERE email = $1";
      const { rows } = await db.query(query, [guestEmail]);
  
      if (rows.length === 0) {
        return res.status(404).json({ success: false, message: "No user found with this email." });
      }
      const guestId = rows[0].id;
  
      // Now update the check_ins table using the guest id
      const updateQuery = "UPDATE check_ins SET payment_status = 'paid' WHERE guest_id = $1";
      const updateResult = await db.query(updateQuery, [guestId]);
  
      if (updateResult.rowCount === 0) {
        return res.status(404).json({ success: false, message: "No active check-in found for this guest." });
      }
  
      console.log(`✅ Checkout finalized for guest id: ${guestId}`);
      return res.json({ success: true, message: "Payment finalized and checkout complete." });
    } catch (err) {
      console.error("❌ Error finalizing checkout:", err);
      return res.status(500).json({ success: false, message: "Server error while finalizing checkout." });
    }
  });








const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
