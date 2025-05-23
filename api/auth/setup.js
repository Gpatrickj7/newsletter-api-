 //Setup script - creates first admin user (DELETE AFTER USE)
const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
    //Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method === 'POST') {
        try {
            const { email, password, name, setupKey } = req.body;
            
            //Security: Only allow with secret setup key
            if (setupKey !== process.env.SETUP_SECRET) {
                return res.status(403).json({ 
                    success: false,
                    error: 'Invalid setup key' 
                });
            }
            
            //Validate inputs
            if (!email || !password || !name) {
                return res.status(400).json({ 
                    success: false,
                    error: 'All fields required' 
                });
            }
            
            if (password.length < 8) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Password must be at least 8 characters' 
                });
            }
            
            //Connect to MongoDB
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            
            const database = client.db('toftewellness');
            const collection = database.collection('admin_users');
            
            //Check if admin already exists
            const existingAdmin = await collection.findOne({ email: email.toLowerCase() });
            if (existingAdmin) {
                await client.close();
                return res.status(400).json({ 
                    success: false,
                    error: 'Admin user already exists' 
                });
            }
            
            //Hash password
            const saltRounds = 12;
            const password_hash = await bcrypt.hash(password, saltRounds);
            
            //Create admin user
            const result = await collection.insertOne({
                email: email.toLowerCase(),
                password_hash: password_hash,
                name: name,
                role: 'admin',
                created_at: new Date(),
                last_login: null
            });
            
            await client.close();
            
            return res.status(200).json({
                success: true,
                message: 'Admin user created successfully',
                userId: result.insertedId
            });
            
        } catch (error) {
            console.error('Setup error:', error);
            return res.status(500).json({ 
                success: false,
                error: 'Server error' 
            });
        }
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
};
