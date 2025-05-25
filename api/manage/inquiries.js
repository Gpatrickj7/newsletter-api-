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
        let client;
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
            client = new MongoClient(process.env.MONGODB_URI);
            await client.connect();
            
            const database = client.db('toftewellness');
            const inquiriesCollection = database.collection('contact_inquiries');
            
            // Check if collection exists
            const collectionExists = await database.listCollections({name: 'contact_inquiries'}).hasNext();
            console.log('Contact inquiries collection exists:', collectionExists);
            
            // If collection doesn't exist, return empty data
            if (!collectionExists) {
                await client.close();
                return res.status(200).json({
                    success: true,
                    data: {
                        inquiries: [],
                        stats: {
                            total: 0,
                            today: 0,
                            thisWeek: 0,
                            byType: []
                        }
                    },
                    message: 'No inquiries collection found - submit a contact form first'
                });
            }
            
            // Get recent inquiries (limited to 50)
            const inquiries = await inquiriesCollection
                .find({})
                .sort({ submitted_at: -1 })
                .limit(50)
                .toArray();
            
            console.log('Found inquiries:', inquiries.length);
            
            // Calculate stats
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            
            const total = await inquiriesCollection.countDocuments();
            const today = await inquiriesCollection.countDocuments({
                submitted_at: { $gte: todayStart }
            });
            const thisWeek = await inquiriesCollection.countDocuments({
                submitted_at: { $gte: weekStart }
            });
            
            // Group by inquiry type
            const byType = await inquiriesCollection.aggregate([
                {
                    $group: {
                        _id: "$inquiryType",
                        count: { $sum: 1 }
                    }
                }
            ]).toArray();
            
            await client.close();
            
            console.log('Inquiries stats:', { total, today, thisWeek, byTypeCount: byType.length });
            
            return res.status(200).json({
                success: true,
                data: {
                    inquiries,
                    stats: {
                        total,
                        today,
                        thisWeek,
                        byType
                    }
                }
            });
            
        } catch (error) {
            console.error('Inquiries API error:', error);
            
            // Better error handling
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false,
                    error: 'Invalid token' 
                });
            }
            
            return res.status(500).json({ 
                success: false,
                error: 'Server error occurred',
                details: error.message
            });
        } finally {
            // Ensure client is always closed
            if (client) {
                await client.close();
            }
        }
    }
    
    return res.status(405).json({ 
        success: false,
        error: 'Method not allowed' 
    });
};