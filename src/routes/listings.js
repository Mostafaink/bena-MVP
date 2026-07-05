const express = require('express');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { getDb } = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const readLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// GET /api/listings — public, list all listings
router.get('/', readLimiter, (req, res) => {
  const db = getDb();
  const listings = db
    .prepare(
      `SELECT l.id, l.title, l.description, l.price, l.created_at,
              u.id AS user_id, u.name AS user_name
       FROM listings l
       JOIN users u ON u.id = l.user_id
       ORDER BY l.created_at DESC`
    )
    .all();
  return res.json(listings);
});

// GET /api/listings/:id — public, single listing
router.get(
  '/:id',
  readLimiter,
  [param('id').isInt({ min: 1 }).withMessage('Invalid listing id')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const listing = db
      .prepare(
        `SELECT l.id, l.title, l.description, l.price, l.created_at,
                u.id AS user_id, u.name AS user_name
         FROM listings l
         JOIN users u ON u.id = l.user_id
         WHERE l.id = ?`
      )
      .get(req.params.id);

    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    return res.json(listing);
  }
);

// POST /api/listings — protected, create listing
router.post(
  '/',
  writeLimiter,
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').optional().trim(),
    body('price').isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description = '', price } = req.body;
    const db = getDb();
    const result = db
      .prepare('INSERT INTO listings (user_id, title, description, price) VALUES (?, ?, ?, ?)')
      .run(req.user.id, title, description, price);

    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(listing);
  }
);

// PATCH /api/listings/:id — protected, update own listing
router.patch(
  '/:id',
  writeLimiter,
  authenticate,
  [
    param('id').isInt({ min: 1 }).withMessage('Invalid listing id'),
    body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
    body('description').optional().trim(),
    body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a non-negative number'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    const title = req.body.title ?? listing.title;
    const description = req.body.description ?? listing.description;
    const price = req.body.price ?? listing.price;

    db.prepare(
      `UPDATE listings SET title = ?, description = ?, price = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(title, description, price, listing.id);

    return res.json(db.prepare('SELECT * FROM listings WHERE id = ?').get(listing.id));
  }
);

// DELETE /api/listings/:id — protected, delete own listing
router.delete(
  '/:id',
  writeLimiter,
  authenticate,
  [param('id').isInt({ min: 1 }).withMessage('Invalid listing id')],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const db = getDb();
    const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

    db.prepare('DELETE FROM listings WHERE id = ?').run(listing.id);
    return res.status(204).send();
  }
);

module.exports = router;
