//imports for auth 
const {MongoClient} = require('mongodb');  //mogodb client for database connection
const bcrypt = require('bcryptjs');        //bcrypt for password hashing/verification
const jwt = require('jsonwebtoken');       //jwt for creating authentication tokens 


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
            const { email, password } = req.body;   //Extract email and password from request

            if (!email || !password) {
                return res.status(400).json({      //400 bad request
                    success: false,
                    error: 'Email and password required'
                });
            }

            //connect to mongoDB Database
            const client = new MongoClient(process.env.MONGODB_URI);    //connection string 
            await client.connect();

            const database = client.db('toftewellness');                   //access 'newsletter' db
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
}