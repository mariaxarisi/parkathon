import kDTree from './lib/kdtree.js';
import parking from './lib/parking.js';
import openAI from 'openai';
import 'dotenv/config';

// import 'dotenv/config'; // Automatically loads .env

import express from "express";
import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import cors from 'cors';

dotenv.config();
const prt = 9000;
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

app.use(express.json());
app.use(cookieParser());
app.use(cors({
	origin: 'http://localhost',
	methods: 'GET,POST,PUT,DELETE',
	credentials: true
  }));

app.use(cors());
app.use(express.json());

const db = await mysql.createPool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});

const openai = new openAI({ apiKey: process.env.OPENAI_API_KEY});

const verifyToken = (req, res, next) => {
    const token = req.cookies.user_token;

    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};


app.post('/user/signup', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Check if user exists
        const [existingUser] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into DB
        const [result] = await db.query(
            'INSERT INTO user (name, email, password) VALUES (?, ?, ?)',
            [name, email, hashedPassword]
        );

        if (result.affectedRows === 1) {
            res.json({ success: true, message: "User registered successfully" });
        } else {
            res.status(500).json({ error: "Registration failed" });
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


app.post('/user/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "All fields are required" });
    }

    try {
        // Check if user exists
        const [users] = await db.query('SELECT * FROM user WHERE email = ?', [email]);

        if (users.length === 0) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = users[0];

        // Verify password
        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Generate JWT Token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
		
        res.cookie('user_token', token, { secure: false });

        res.json({ success: true, message: "Login successful", token });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/user/profile', verifyToken, async (req, res) => {
    const [users] = await db.query('SELECT user_id, name, email FROM user WHERE user_id = ?', [req.user.userId]);

    if (users.length === 0) {
        return res.status(401).json({ error: "User not found" });
    }

    res.json(users[0]);
});

app.post('/user/logout', (req, res) => {
    res.clearCookie('user_token');
    res.json({ success: true, message: "Logged out successfully" });
});

app.get('/park/list/active', async (req, res) => {
	let {
		user,
	} = req.query;
	
	if (!user /* or user not in database */) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const [rows] = await db.query(`SELECT * FROM parking WHERE user_id = ${user} AND end_time IS NULL;`);
		return res.json(rows);
	} catch (error) {
		return res.status(500).json({ error: "Failed to register parking spot occupation" });
	}
});

app.post('/park/list/all', async (req, res) => {
	let {
		user,
	} = req.query;
	
	if (!user /* or user not in database */) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const [rows] = await db.query(`SELECT * FROM parking WHERE user_id = ${user};`);
		return res.json(rows);
	} catch (error) {
		return res.status(500).json({ error: "Failed to register parking spot occupation" });
	}
});

app.post('/park/occupy', async (req, res) => {
	let {
		user,
		lat,
		lon,
	} = req.query;
	
	if (!lat || !lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	if (!user /* or user not in database */) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const q = 'INSERT INTO parking (user_id, lat, lon) VALUES (?, ?, ?)';
        const v = [user, lat, lon];
		const [results] = await db.execute(q, v);
		res.json(results);
	} catch (error) {
		return res.status(500).json({ error: "Failed to register parking spot occupation" });
	}
});

app.post('/park/vacay', async (req, res) => {
	let {
		parking,
		user,
	} = req.query;
	
	if (!parking /* or parking not in database */) {
		return res.status(400).json({ error: "Invalid parking id provided" });
	}
	if (!user /* or user not in database */) {
		return res.status(400).json({ error: "Invalid user id provided" });
	}
	
	try {
		const q = 'UPDATE parking SET end_time = NOW() WHERE parking_id = ? AND user_id = ? AND end_time IS NULL';
        const v = [parking, user];
		const [results] = await db.execute(q, v);
		res.json(results);
	} catch (error) {
		return res.status(500).json({ error: "Failed to register parking spot occupation" });
	}
});

app.get('/park/find', async (req, res) => {
	let {
		lat,
		lon,
		rad,
	} = req.query;
	
	if (!lat || !lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	rad = rad || 50; // By default the radius is 50m
	
	try {
		const tree = new kDTree();
		const data = await parking.OpenStreetMapFetchRoadsAt(lat, lon, rad);
		const spot = parking.GeographicDataToParkingSpaces(data);
		
		tree.InsertPoints(spot);
		
		const [rows] = await db.query('SELECT * FROM parking WHERE start_time <= NOW() AND end_time IS NULL;');
		rows.forEach((entry) => {
			/** Remove the nearest parking spot in a radius of 12m (the distance of two cars). */
			tree.RemoveNearest(parking.GeographicToEuclidean({
				lat: entry.lat,
				lon: entry.lon,
			}), 12);
		});
    
		return res.json(tree.Query(parking.GeographicToEuclidean({
				lat: lat,
				lon: lon,
		}), rad));
	} catch (error) {
		return res.status(500).json({ error: "Failed to fetch parking information near location" });
	}
});

app.get('/park/demo/clean', async (req, res) => {
	const user = 1;
	
	try {
		const [result] = await db.execute(
			'DELETE FROM parking WHERE user_id = ?',
			[user]
		);
		
		return res.json(result);
	} catch (error) {
		return res.status(500).json({ error: "Failed to clean demo parking locations" });
	}
});

app.get('/park/demo/simulate', async (req, res) => {
	let {
		q_lat,
		q_lon,
		rad,
	} = req.query;
	
	if (!q_lat || !q_lon) {
		return res.status(400).json({ error: "Latitude and longitude are required" });
	}
	
	rad = rad || 100; // By default the radius is 100m
	
	const RandomWithinRadius = (in_lat, in_lon, in_rad) => {
		const R_lat = (in_rad / 111320); // 1 degree ≈ 111.32 km
		const R_lon = (in_rad / (111320 * Math.cos(in_lat * (Math.PI / 180))));
		return {
			lat: in_lat + (Math.random() - 0.5) * R_lat * 2,
			lon: in_lon + (Math.random() - 0.5) * R_lon * 2,
		};
	};
	
	try {
		const data = await parking.OpenStreetMapFetchRoadsAt(q_lat, q_lon, rad);
		const spot = parking.GeographicDataToParkingSpaces(data);
		
		const fake = [];
		const user = 1;
		
		/**
		 * Some people might end up parking on the sea... that shouldn't really be a problem though!
		 */
		const mark = Math.floor(spot.length * (0.9 + Math.random() * 0.1));
		
		for (let i = 0; i < mark; i++) {
			const {
				lat,
				lon
			} = RandomWithinRadius(parseFloat(q_lat), parseFloat(q_lon), rad);
			const [result] = await db.execute(
				'INSERT INTO parking (user_id, lat, lon) VALUES (?, ?, ?)',
				[user, lat, lon]
			);
			fake.push(result.insertId);
		}
		
		/** Less than 10% of the occupied parking spots will be released! */
		const free = Math.floor(fake.length * Math.random() * 0.1);
		
		for (let i = 0; i < free; i++) {
			const id = fake[Math.floor(Math.random() * fake.length)];
			const [result] = await db.execute(
				'UPDATE parking SET end_time = NOW() WHERE parking_id = ? AND user_id = ? AND end_time IS NULL',
				[id, user]
			);
		}
		
		return res.json({
			total: spot.length,
			count: mark,
			freed: free
		});
	} catch (error) {
		return res.status(500).json({ error: "Failed to simulate parking near location" });
	}
});

app.get("/transcript", async (req, res) => {
    let { text } = req.query;

    if (!text) {
        return res.status(400).json({ error: "Text query is required" });
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a location extractor. Extract only the location name from the given text. Respond with just the location name, nothing else. If the user specifies the road or any other information that correlates with the location, add that as well. The final result should be a location on the map.",
                },
                {
                    role: "user",
                    content: text,
                },
            ],
            temperature: 0.2,
            max_tokens: 70,
        });

        const location = completion.choices[0].message.content.trim();
        return res.json({ location });
    } catch (error) {
        return res
            .status(500)
            .json({ error: "Failed to process location from text" });
    }
});

app.listen(prt, () => console.log(`Backend running on port ${prt}`));
