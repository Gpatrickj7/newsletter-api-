 const { MongoClient } = require('mongodb');

 // Rate limiting storage (in-memory)
const newsletterAttempts = new Map();

// Rate limiting function
function checkRateLimit(ip, maxAttempts = 3, windowMs = 60 * 60 * 1000) { // 3 per hour
    const now = Date.now();
    const key = `newsletter_${ip}`;
    
    const attempts = newsletterAttempts.get(key) || [];
    const validAttempts = attempts.filter(time => now - time < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
        return false; // Rate limited
    }
    
    validAttempts.push(now);
    newsletterAttempts.set(key, validAttempts);
    return true; // Allow request
}

module.exports = async (req, res) => {
  // Enables CORS GitHub Pages domain
  
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
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
          error: 'Too many signup attempts. Please try again in an hour.'
        });
      }
      // Parse the email from request body
      const { email } = req.body;
     
      //Check if email exists
      if (!email) {
        return res.status(400).json ({
          success: false,
          error: 'Email is required'
        });
      }
      
      // Input sanitization
      const sanitizedEmail = email.trim().toLowerCase();

      // Email length limit (RFC 5321 standard)
      if (sanitizedEmail.length > 254) {
        return res.status(400).json({
          success: false,
          error: 'Email address is too long'
        });
      }

      // Enhanced email validation regex
      const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

      if (!emailRegex.test(sanitizedEmail)) {
        return res.status(400).json({ 
          success: false,
          error: 'Please enter a valid email address' 
        });
      }

      // Additional security checks 
      if (sanitizedEmail.includes('..') || sanitizedEmail.startsWith('.') || sanitizedEmail.endsWith('.')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      


      // Connect to MongoDB
      const client = new MongoClient(process.env.MONGODB_URI);


      await client.connect();
      console.log('Connected to MongoDB');
      
      const database = client.db('toftewellness');
      const collection = database.collection('subscribers');
      
      // Check if email already exists
      const existingUser = await collection.findOne({ email: sanitizedEmail });
      if (existingUser) {
        await client.close();
        return res.status(200).json({ 
          success: true,
          message: 'Email already registered',
          alreadyExists: true
        });
      }
      
      // Insert new subscriber
      const result = await collection.insertOne({
        email: sanitizedEmail,
        subscribed_at: new Date(),
        source: req.headers.referer || 'direct',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });
      
      await client.close();
      console.log('Subscriber added:', sanitizedEmail);
      
      return res.status(200).json({ 
        success: true,
        message: 'Subscription successful',
        id: result.insertedId
      });
      
    } catch (error) {
      console.error('Server error:', error);
      return res.status(500).json({ 
        success: false,
        error: 'Server error occurred'
      });
    }
  }
  
  // Method not allowed
  return res.status(405).json({ 
    success: false,
    error: 'Method not allowed' 
  });
};
