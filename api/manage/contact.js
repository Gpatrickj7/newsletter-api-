 const { MongoClient } = require('mongodb');

// Rate limiting storage (in-memory)
const contactAttempts = new Map();

// Rate limiting function
function checkRateLimit(ip, maxAttempts = 5, windowMs = 60 * 60 * 1000) { // 5 per hour
    const now = Date.now();
    const key = `contact_${ip}`;
    
    const attempts = contactAttempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
        return false;
    }
    
    validAttempts.push(now);
    contactAttempts.set(key, validAttempts);
    return true;
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method === 'POST') {
        try {
            const clientIP = req.headers['x-forwarded-for'] || 
                           req.headers['x-real-ip'] || 
                           req.connection.remoteAddress || 
                           'unknown';
            
            if (!checkRateLimit(clientIP)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many contact attempts. Please try again later.'
                });
            }

            const { name, email, inquiryType, message } = req.body;
            
            // Validation
            if (!name || !email || !inquiryType || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'All fields are required'
                });
            }
            
            // Sanitization
            const sanitizedData = {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                inquiryType: inquiryType,
                message: message.trim()
            };

            // Email validation
            const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
            
            if (!emailRegex.test(sanitizedData.email)) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Please enter a valid email address' 
                });
            }

            // Connect to MongoDB
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            
            const database = client.db('toftewellness');
            const collection = database.collection('contact_inquiries');
            
            // Insert inquiry
            const result = await collection.insertOne({
                ...sanitizedData,
                submitted_at: new Date(),
                status: 'new',
                source: req.headers.referer || 'direct',
                ip_address: clientIP
            });
            
            await client.close();
            console.log('Contact inquiry added:', sanitizedData.email);
            
            return res.status(200).json({ 
                success: true,
                message: 'Your message has been sent successfully!',
                id: result.insertedId
            });
            
        } catch (error) {
            console.error('Contact form error:', error);
            return res.status(500).json({ 
                success: false,
                error: 'Server error occurred. Please try again.'
            });
        }
    }
    
    return res.status(405).json({ 
        success: false,
        error: 'Method not allowed' 
    });
};
