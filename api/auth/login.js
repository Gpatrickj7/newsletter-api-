 //imports for auth 
const {MongoClient} = require('mongodb');  //mongodb client for database connection
const bcrypt = require('bcryptjs');        //bcrypt for password hashing/verification
const jwt = require('jsonwebtoken');       //jwt for creating authentication tokens 

// Rate limiting storage (in-memory)
const loginAttempts = new Map();

//Rate limiting function
function checkRateLimit(ip, maxAttempts = 5, windowMs = 15 * 60 *1000) {
    const now = Date.now();
    const key = `login_${ip}`;

    // Get current attemps for this IP
    const attempts = loginAttempts.get(key) || [];

    // Remove old attempts outside the time winodw
    const validAttempts = attempts.filter(time => now - time < windowMs);

    // Check if over limit
    if (validAttempts.length >= maxAttempts) {
        return false; // Rate limited
    }

    // Add this attempt
    validAttempts.push(now);
    loginAttempts.set(key, validAttempts);

    return true; // Allow request
}
module.exports = async (req, res) => {   //Export as async (Vercel Serverless pattern)

    //CORS headers allowing website to call this API 
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com'); //Only allow my domain
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');            //Allow OPTIONS and POST
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');             //Allow JSON content

    //handle preflight requests (browser sends before actual request)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();           //Just respond OK to preflight
    }

    //Only process POST requests (login submissions)
    if (req.method === 'POST') {
        try {

            //Get client IP
            const clientIP = req.headers['x-forwarded-for'] ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            'unknown';

            // Check rate limit
            if (!checkRateLimit(clientIP)) {
                return res.status(429).json ({
                    success: false,
                    error: 'Too many login attempts. Please try again in 15 minutes.'
                });
            }


            const { email, password } = req.body;   //Extract email and password from request

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


            //connect to mongoDB Database
            const client = new MongoClient(process.env.MONGODB_URI);    //connection string 
            await client.connect();

            const database = client.db('toftewellness');                   //access 'toftewellness' db
            const collection = database.collection('admin_users');      //access 'admin_users' collection

            //Look for admin user with this email
            const adminUser = await collection.findOne({ email: email.toLowerCase() });  //search by email (lowercase)
            
            // If no user found with this email
            if (!adminUser) {
                await client.close();               //close database connection
                return res.status(401).json({       //401 = Unauthorized
                    success: false,
                    error: 'Invalid credentials'    //Generic error (does not reveal if email exists)
                });
            }

            //check if provided password matches stored hash
            const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);

            //If password doesn't match
            if (!isValidPassword) {
                await client.close();           //close database connection
                return res.status(401).json({    //401 = unauthorized
                    success: false,
                    error: 'Invalid credentials' //same generic error
                });     
            }

            //Login successful! Create JWT token
            const token = jwt.sign(
                {                                     //Token payload (data stored in token)
                    userId: adminUser._id,            //User's database ID
                    email: adminUser.email,           //User's email
                    role: 'admin'                     //User's role (for authorization)
                },
                process.env.JWT_SECRET,               //Secret key for signing token (from env var)
                { expiresIn: '24h' }                  //Token expires in 24 hours
            );

            //Update the user's last login timestamp
            await collection.updateOne(
                { _id: adminUser._id },               //Find this user
                { $set: { last_login: new Date() } } //Update last_login field
            );

            await client.close();                    //Close database connection

            //Send successful login response
            return res.status(200).json({            //200 = Success
                success: true,
                token: token,                        //JWT token for future requests
                user: {                              //User info (safe to send - no password)
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

    //If request method is not POST or OPTIONS
    return res.status(405).json({ error: 'Method not allowed'});  //405 method not allowed 
};
