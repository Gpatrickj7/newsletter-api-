// imports for auth 
const {MongoClient} = require('mongodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Rate limiting storage (in-memory)
const loginAttempts = new Map();

// Rate limiting function
function checkRateLimit(ip, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const key = `login_${ip}`;

    const attempts = loginAttempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < windowMs);

    if (validAttempts.length >= maxAttempts) {
        return false;
    }

    validAttempts.push(now);
    loginAttempts.set(key, validAttempts);
    return true;
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only process POST requests
    if (req.method === 'POST') {
        try {
            // Get client IP
            const clientIP = req.headers['x-forwarded-for'] ||
                           req.headers['x-real-ip'] ||
                           req.connection.remoteAddress ||
                           'unknown';

            // Check rate limit
            if (!checkRateLimit(clientIP)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many login attempts. Please try again in 15 minutes.'
                });
            }

            const { email, password } = req.body;

            // Validate input
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email and password are required'
                });
            }

            // Connect to MongoDB
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();

            const database = client.db('toftewellness');
            const collection = database.collection('admin_users');

            // Look for admin user with this email
            const adminUser = await collection.findOne({ email: email.toLowerCase() });
            
            if (!adminUser) {
                await client.close();
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            // Check password
            const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);

            if (!isValidPassword) {
                await client.close();
                return res.status(401).json({
                    success: false,
                    error: 'Invalid credentials'
                });
            }

            // Create JWT token
            const token = jwt.sign(
                {
                    userId: adminUser._id,
                    email: adminUser.email,
                    role: 'admin'
                },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            // Update last login
            await collection.updateOne(
                { _id: adminUser._id },
                { $set: { last_login: new Date() } }
            );

            await client.close();

            return res.status(200).json({
                success: true,
                token: token,
                user: {
                    email: adminUser.email,
                    name: adminUser.name,
                    role: 'admin'
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
                success: false,
                error: 'Server error'
            });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};