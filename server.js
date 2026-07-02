const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Database Connection Pool based on your ERD
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // Replace with your MySQL username
    password: '', // Replace with your MySQL password
    database: 'badminton_booking'
});

// ==========================================
// AUTHENTICATION ROUTES (Requirement 2)
// ==========================================

// User Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [users] = await pool.query('SELECT * FROM Users WHERE email = ? AND password = ?', [email, password]);
        if (users.length > 0) {
            res.json({ success: true, user: users[0] });
        } else {
            res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// User Registration
app.post('/api/register', async (req, res) => {
    const { name, email, password, phone } = req.body;
    try {
        const [result] = await pool.query(
            'INSERT INTO Users (full_name, email, password, phone_number) VALUES (?, ?, ?, ?)',
            [name, email, password, phone]
        );
        res.json({ success: true, userId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Email already registered or database error.' });
    }
});

// ==========================================
// PROFILE ROUTE (Requirement 3)
// ==========================================

app.put('/api/users/:id', async (req, res) => {
    const { name, phone, password } = req.body;
    try {
        await pool.query(
            'UPDATE Users SET full_name = ?, phone_number = ?, password = ? WHERE user_id = ?',
            [name, phone, password, req.params.id]
        );
        const [updatedUser] = await pool.query('SELECT * FROM Users WHERE user_id = ?', [req.params.id]);
        res.json({ success: true, user: updatedUser[0] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update profile.' });
    }
});

// ==========================================
// MEMBERSHIP ROUTES
// ==========================================

// Apply/Update Membership
app.post('/api/memberships', async (req, res) => {
    const { userId, type, startDate, expiryDate } = req.body;
    try {
        const [existing] = await pool.query('SELECT * FROM Memberships WHERE user_id = ?', [userId]);
        
        if (existing.length > 0) {
            await pool.query(
                'UPDATE Memberships SET membership_type = ?, start_date = ?, expiry_date = ?, status = "Active" WHERE user_id = ?',
                [type, startDate, expiryDate, userId]
            );
        } else {
            await pool.query(
                'INSERT INTO Memberships (user_id, membership_type, start_date, expiry_date, status) VALUES (?, ?, ?, ?, "Active")',
                [userId, type, startDate, expiryDate]
            );
        }
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to process membership.' });
    }
});

// Get Active Membership
app.get('/api/memberships/:userId', async (req, res) => {
    try {
        const [memberships] = await pool.query('SELECT * FROM Memberships WHERE user_id = ? AND status = "Active"', [req.params.userId]);
        res.json({ membership: memberships.length > 0 ? memberships[0] : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error.' });
    }
});

// ==========================================
// BOOKING & AVAILABILITY ROUTES (Requirement 4)
// ==========================================

// Check Availability
app.get('/api/availability', async (req, res) => {
    const { court, date } = req.query;
    try {
        const [courts] = await pool.query('SELECT court_id FROM Courts WHERE court_name = ?', [court]);
        if (courts.length === 0) return res.json({ bookedSlots: [] });

        const courtId = courts[0].court_id;
        const [bookings] = await pool.query(
            'SELECT start_time, end_time FROM Bookings WHERE court_id = ? AND booking_date = ? AND status != "Rejected"',
            [courtId, date]
        );

        const formatTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            return `${displayH}:${minutes} ${ampm}`;
        };

        const bookedSlots = bookings.map(b => `${formatTime(b.start_time)} - ${formatTime(b.end_time)}`);
        res.json({ bookedSlots });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error.' });
    }
});

// Create Booking
app.post('/api/bookings', async (req, res) => {
    const { userId, courtName, date, startTime, endTime, amount } = req.body;
    try {
        const [courts] = await pool.query('SELECT court_id FROM Courts WHERE court_name = ?', [courtName]);
        if (courts.length === 0) return res.status(400).json({ success: false, message: 'Invalid court selected.' });
        
        const courtId = courts[0].court_id;

        const to24h = (time12h) => {
            const [time, modifier] = time12h.split(' ');
            let [hours, minutes] = time.split(':');
            if (hours === '12') hours = '00';
            if (modifier === 'PM') hours = parseInt(hours, 10) + 12;
            return `${hours}:${minutes}:00`;
        };

        const dbStartTime = to24h(startTime);
        const dbEndTime = to24h(endTime);

        const [conflicts] = await pool.query(
            'SELECT * FROM Bookings WHERE court_id = ? AND booking_date = ? AND start_time = ? AND status != "Rejected"',
            [courtId, date, dbStartTime]
        );

        if (conflicts.length > 0) {
            return res.status(400).json({ success: false, message: 'Slot already booked.' });
        }

        const [result] = await pool.query(
            'INSERT INTO Bookings (user_id, court_id, booking_date, start_time, end_time, total_price, status) VALUES (?, ?, ?, ?, ?, ?, "Pending")',
            [userId, courtId, date, dbStartTime, dbEndTime, amount]
        );

        res.json({ success: true, bookingId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Database error.' });
    }
});

// ==========================================
// PAYMENT ROUTES
// ==========================================

// Get Specific Booking
app.get('/api/bookings/:id', async (req, res) => {
    try {
        const [bookings] = await pool.query('SELECT * FROM Bookings WHERE booking_id = ?', [req.params.id]);
        res.json({ booking: bookings.length > 0 ? bookings[0] : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error.' });
    }
});

// Get Latest Unpaid Booking
app.get('/api/bookings/unpaid/:userId', async (req, res) => {
    try {
        const [bookings] = await pool.query(`
            SELECT b.* FROM Bookings b
            LEFT JOIN Payments p ON b.booking_id = p.booking_id
            WHERE b.user_id = ? AND p.payment_id IS NULL
            ORDER BY b.booking_id DESC LIMIT 1
        `, [req.params.userId]);
        
        res.json({ booking: bookings.length > 0 ? bookings[0] : null });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error.' });
    }
});

// Process Payment
app.post('/api/payments', async (req, res) => {
    const { bookingId, method, amount, date } = req.body;
    try {
        const transactionId = `TXN-${Date.now()}`;
        await pool.query(
            'INSERT INTO Payments (booking_id, payment_method, amount, payment_date, payment_status, transaction_id) VALUES (?, ?, ?, ?, "Paid", ?)',
            [bookingId, method, amount, date, transactionId]
        );

        await pool.query('UPDATE Bookings SET status = "Approved" WHERE booking_id = ?', [bookingId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Payment failed.' });
    }
});

// ==========================================
// HISTORY ROUTE (Requirement 5)
// ==========================================

// Get User Booking History
app.get('/api/history/:userId', async (req, res) => {
    try {
        const [bookings] = await pool.query(`
            SELECT b.booking_id, c.court_name, b.booking_date, b.start_time, b.end_time, b.status, p.payment_status
            FROM Bookings b
            JOIN Courts c ON b.court_id = c.court_id
            LEFT JOIN Payments p ON b.booking_id = p.booking_id
            WHERE b.user_id = ?
            ORDER BY b.booking_date DESC, b.start_time DESC
        `, [req.params.userId]);

        const formatTime = (timeStr) => {
            const [hours, minutes] = timeStr.split(':');
            const h = parseInt(hours);
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h % 12 || 12;
            return `${displayH}:${minutes} ${ampm}`;
        };

        const formattedBookings = bookings.map(b => ({
            ...b,
            start_time: formatTime(b.start_time),
            end_time: formatTime(b.end_time)
        }));

        res.json({ bookings: formattedBookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error.' });
    }
});

// ==========================================
// ADMIN DASHBOARD ROUTES (Requirements 6, 7, 8)
// ==========================================

// Get All Users
app.get('/api/admin/users', async (req, res) => {
    try {
        const [users] = await pool.query('SELECT user_id, full_name, email, phone_number FROM Users WHERE role = "Customer"');
        res.json({ users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error retrieving users.' });
    }
});

// Search & Filter Bookings
app.get('/api/admin/bookings', async (req, res) => {
    const { search, status, date } = req.query;
    
    let query = `
        SELECT b.booking_id, u.full_name, c.court_name, b.booking_date, b.start_time, b.end_time, b.status 
        FROM Bookings b
        JOIN Users u ON b.user_id = u.user_id
        JOIN Courts c ON b.court_id = c.court_id
        WHERE 1=1
    `;
    const params = [];

    if (search) {
        query += ` AND u.full_name LIKE ?`;
        params.push(`%${search}%`);
    }
    if (status) {
        query += ` AND b.status = ?`;
        params.push(status);
    }
    if (date) {
        query += ` AND b.booking_date = ?`;
        params.push(date);
    }

    query += ` ORDER BY b.booking_date DESC`;

    try {
        const [bookings] = await pool.query(query, params);
        res.json({ bookings });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Database error retrieving bookings.' });
    }
});

// Approve / Reject Booking
app.put('/api/admin/bookings/:id', async (req, res) => {
    const { action, remarks } = req.body; 
    const bookingId = req.params.id;

    try {
        await pool.query('UPDATE Bookings SET status = ? WHERE booking_id = ?', [action, bookingId]);

        await pool.query(
            'INSERT INTO Booking_History (booking_id, action, remarks) VALUES (?, ?, ?)',
            [bookingId, action, remarks || 'Updated by Admin']
        );

        res.json({ success: true, message: `Booking ${action} successfully.` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update booking status.' });
    }
});

// Start Server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is successfully running on http://localhost:${PORT}`);
});