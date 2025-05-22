 const { MongoClient } = require('mongodb');

module.exports = async (req, res) => {
  // Enable CORS for your GitHub Pages domain
  // Replace 'yourusername' with your actual GitHub username
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://yourusername.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method === 'POST') {
    try {
      // Parse the email from request body
      const { email } = req.body;
      
      // Validate email
      if (!email || !email.includes('@')) {
        return res.status(400).json({ 
          success: false,
          error: 'Valid email required' 
        });
      }
      
      // Connect to MongoDB
      const client = new MongoClient(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      
      await client.connect();
      console.log('Connected to MongoDB');
      
      const database = client.db('newsletter');
      const collection = database.collection('subscribers');
      
      // Check if email already exists
      const existingUser = await collection.findOne({ email: email.toLowerCase() });
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
        email: email.toLowerCase(),
        subscribed_at: new Date(),
        source: req.headers.referer || 'direct',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });
      
      await client.close();
      console.log('Subscriber added:', email);
      
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
