import express from 'express';
import { authenticateAdmin, createAdmin, getAdminById } from '../auth/auth.js';
import { canCreateAdmin } from '../services/limits.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if we can create a new admin
    const limitCheck = await canCreateAdmin();
    if (!limitCheck.allowed) {
      return res.status(429).json({ error: limitCheck.reason });
    }

    const admin = await createAdmin(username, password);

    req.session.adminId = admin.id;

    res.json({
      id: admin.id,
      username: admin.username,
      is_super_admin: admin.is_super_admin,
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const admin = await authenticateAdmin(username, password);

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.adminId = admin.id;

    res.json({
      id: admin.id,
      username: admin.username,
      is_super_admin: admin.is_super_admin,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

router.get('/me', async (req, res) => {
  if (!req.session.adminId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const admin = await getAdminById(req.session.adminId);

  if (!admin) {
    return res.status(404).json({ error: 'Admin not found' });
  }

  res.json({
    id: admin.id,
    username: admin.username,
    is_super_admin: admin.is_super_admin,
  });
});

export default router;
