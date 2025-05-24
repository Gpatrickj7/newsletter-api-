 const { MongoClient } = require('mongodb');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', 'https://toftewellness.com');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method === 'GET') {
        try {
            // Verify JWT token
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ 
                    success: false,
                    error: 'No token provided' 
                });
            }
            
            const token = authHeader.substring(7);
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (decoded.role !== 'admin') {
                return res.status(403).json({ 
                    success: false,
                    error: 'Access denied' 
                });
            }

            // Connect to MongoDB
            const client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            
            const database = client.db('toftewellness');
            const subscribersCollection = database.collection('subscribers');
            
            // Get subscribers
            const subscribers = await subscribersCollection
                .find({})
                .sort({ subscribed_at: -1 })
                .limit(100)
                .toArray();
            
            // Calculate stats
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            const total = await subscribersCollection.countDocuments();
            const today = await subscribersCollection.countDocuments({
                subscribed_at: { $gte: todayStart }
            });
            const thisWeek = await subscribersCollection.countDocuments({
                subscribed_at: { $gte: weekStart }
            });
            
            await client.close();
            
            return res.status(200).json({
                success: true,
                data: {
                    subscribers,
                    stats: {
                        total,
                        today,
                        thisWeek
                    }
                }
            });
            
        } catch (error) {
            console.error('Admin API error:', error);
            return res.status(500).json({ 
                success: false,
                error: 'Server error occurred'
            });
        }
    }
    
    return res.status(405).json({ 
        success: false,
        error: 'Method not allowed' 
    });
};
