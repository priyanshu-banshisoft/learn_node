const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
app.use(express.json());

const SECRET_KEY = 'KBTMo1RaFMdsF1yuTEO1/Cfo/CdFbJvprsd/djrx9hQ='; // Replace with your secret key


const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Token missing' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
};

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const token = jwt.sign({ id: this.lastID, username: username }, SECRET_KEY, { expiresIn: '1h' });
        const user = {id:  this.lastID, username ,password : hashedPassword}
        res.json({ user ,token });
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
        res.json({ user, token });
    });
});


app.post('/todos', authenticateToken, (req, res) => {
    const { title } = req.body;
    const { id: userId } = req.user;

    db.run('INSERT INTO todos (title, completed, userId) VALUES (?, ?, ?)', [title, 0, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, title, completed: 0 });
    });
});

app.get('/todos', authenticateToken, (req, res) => {
    const { id: userId } = req.user;

    db.all('SELECT * FROM todos WHERE userId = ?', [userId], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

app.get('/todos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    db.get('SELECT * FROM todos WHERE id = ? AND userId = ?', [id, userId], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json(row);
    });
});

// Update a todo
app.put('/todos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, completed } = req.body;
    const { id: userId } = req.user;

    db.run('UPDATE todos SET title = ?, completed = ? WHERE id = ? AND userId = ?', [title, completed, id, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.json({ id, title, completed });
    });
});

// Delete a todo
app.delete('/todos/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    db.run('DELETE FROM todos WHERE id = ? AND userId = ?', [id, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Todo not found' });
        }
        res.status(204).end();
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
