import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import User from './models/User.js';
import Task from './models/Card.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { body, validationResult } from 'express-validator';

const app = express();
app.use(cors({ 
    credentials: true, 
    origin: process.env.API_URL,
    methods: 'GET,POST,PUT,DELETE',
}));
app.use(express.json());
// app.use(express.json());
app.use(cookieParser());

mongoose.connect('mongodb://arunaasureshkumar:l0nKbLbF1L0HvA6o@ac-jizlebv-shard-00-00.fjd4cfm.mongodb.net:27017,ac-jizlebv-shard-00-01.fjd4cfm.mongodb.net:27017,ac-jizlebv-shard-00-02.fjd4cfm.mongodb.net:27017/?replicaSet=atlas-omwi2v-shard-0&ssl=true&authSource=admin', {
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.log('MongoDB connection error:', err));

const salt = bcrypt.genSaltSync(10);
const secret = 'qwerfcbvhnjklpwsdfxcvghu';

const validateErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

app.post('/register', 
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('name').notEmpty().withMessage('First name is required'),
    validateErrors,
    async (req, res) => {
        console.log('request', req.body);
        const { email, password, name } = req.body;
        try {
            const userDoc = await User.create({
                email, 
                password: bcrypt.hashSync(password, salt),
                name,
            });
            res.json(userDoc);
        } catch (error) {
            res.status(500).json({ message: 'Error registering user', error });
        }
    }
);

app.post('/login', 
    body('email').isEmail().withMessage('Invalid email format'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    validateErrors,
    async (req, res) => {
        console.log('inside login', req.body);
        const { email, password } = req.body;
        try {
            const userDoc = await User.findOne({ email });
            if (!userDoc) {
                return res.status(400).json('Wrong Credentials');
            }
            console.log('userDoc', userDoc);
            const passok = bcrypt.compareSync(password, userDoc.password);
            if (passok) {
                jwt.sign({ email, id: userDoc._id }, secret, {}, (err, token) => {
                    if (err) {
                        res.status(500).json('Error signing token');
                        return;
                    }
                    res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax' }).json({
                        id: userDoc._id,
                        email,
                    });
                });
            } else {
                res.status(400).json('Wrong password Credentials');
            }
        } catch (error) {
            console.error('Error logging user:', error);
            res.status(500).json({ message: 'Error logging user', error });
        }
    }
);

app.post('/profile', (req, res) => {
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).json({ error: 'Token must be provided' });
    }
    
    jwt.verify(token, secret, {}, (err, info) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        res.json(info);
    });
});

app.post('/logout', (req, res) => {
    res.cookie('token', '', { httpOnly: true, secure: false, sameSite: 'lax' }).json('ok');
});

app.post('/create', 
    body('title').notEmpty().withMessage('Title is required'),
    body('description').notEmpty().withMessage('Description is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('deadline').notEmpty().withMessage('Deadline is required').isISO8601().toDate(),
    body('priority').notEmpty().withMessage('Priority is required').isIn(['Low', 'Medium', 'Urgent']),
    validateErrors,
    async (req, res) => {
        const { token } = req.cookies;

        try {
            jwt.verify(token, secret, {}, async (err, info) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid token' });
                }

                const { title, description, category, deadline, priority } = req.body;

                try {
                    const postDoc = await Task.create({
                        title,
                        description,
                        category,
                        deadline,
                        priority,
                        createdBy: info.id,
                    });
                    res.status(201).json(postDoc);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);


app.get('/tasks', async (req, res) => {
    const { token } = req.cookies;
    try {
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }

            try {
                const tasks = await Task.find({ createdBy: info.id });
                res.status(200).json(tasks);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/updateTask', 
    body('taskId').isMongoId().withMessage('Invalid Task ID'),
    body('newCategory').notEmpty().withMessage('New category is required'),
    validateErrors,
    async (req, res) => {
        const { token } = req.cookies;
        const { taskId, newCategory } = req.body;

        try {
            jwt.verify(token, secret, {}, async (err, info) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid token' });
                }

                try {
                    const updatedTask = await Task.findByIdAndUpdate(
                        taskId,
                        { category: newCategory },
                        { new: true }
                    );
                    res.status(200).json(updatedTask);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

app.put('/update/:id', 
    body('title').optional().notEmpty().withMessage('Title is required if provided'),
    body('description').optional().notEmpty().withMessage('Description is required if provided'),
    body('deadline').optional().notEmpty().withMessage('Deadline is required if provided').isISO8601().toDate(),
    body('priority').optional().notEmpty().withMessage('Priority is required if provided').isIn(['Low', 'Medium', 'Urgent']),
    validateErrors,
    async (req, res) => {
        const { token } = req.cookies;
        const { title, description, deadline, priority } = req.body;

        try {
            jwt.verify(token, secret, {}, async (err, info) => {
                if (err) {
                    return res.status(403).json({ error: 'Invalid token' });
                }

                try {
                    const updatedTask = await Task.findByIdAndUpdate(
                        req.params.id,
                        { title, description, deadline, priority },
                        { new: true }
                    );
                    res.status(200).json(updatedTask);
                } catch (error) {
                    res.status(500).json({ error: error.message });
                }
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
);

app.delete('/delete/:id', async (req, res) => {
    const { token } = req.cookies;

    try {
        jwt.verify(token, secret, {}, async (err, info) => {
            if (err) {
                return res.status(403).json({ error: 'Invalid token' });
            }

            try {
                await Task.findByIdAndDelete(req.params.id);
                res.status(200).json({ message: 'Task deleted successfully' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



app.listen(4000, () => {
    console.log('Server running');
});