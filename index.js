import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in .env file');
    process.exit(1);
}

mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB'))
    .catch((err) => {
        console.error('❌ MongoDB connection error:', err);
        process.exit(1);
    });

// Models
const categorySchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    type: { type: String, enum: ['windows', 'doors'], required: true },
    title: { type: String, required: true },
    description: String,
    image: String,
    products: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        description: String,
        longDescription: String,
        image: String,
        specs: { type: mongoose.Schema.Types.Mixed, default: {} }
    }]
}, { timestamps: true });

const promoSchema = new mongoose.Schema({
    tagText: String,
    title: String,
    description: String,
    highlightText: String,
    buttonText: String,
    buttonLink: String
}, { timestamps: true });

const gallerySchema = new mongoose.Schema({
    url: { type: String, required: true },
    title: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, default: 'General' }
}, { timestamps: true });

const Category = mongoose.model('Category', categorySchema);
const Promo = mongoose.model('Promo', promoSchema);
const Gallery = mongoose.model('Gallery', gallerySchema);

// ==================== API ROUTES ====================

// GET all categories (products)
app.get('/api/products', async (req, res) => {
    try {
        const categories = await Category.find().lean();
        res.json(categories);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add a new category
app.post('/api/category', async (req, res) => {
    try {
        const category = await Category.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST sync all products (bulk upsert)
app.post('/api/products/sync', async (req, res) => {
    try {
        const { categories } = req.body;

        // Clear existing and insert new
        await Category.deleteMany({});

        for (const cat of categories) {
            await Category.create(cat);
        }

        res.json({ success: true, message: `Synced ${categories.length} categories` });
    } catch (error) {
        console.error('Error syncing products:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update a single category
app.put('/api/category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Category.findOneAndUpdate(
            { id },
            req.body,
            { new: true, upsert: true, runValidators: true }
        );
        res.json(updated);
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE a category
app.delete('/api/category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Category.findOneAndDelete({ id });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== PROMO ROUTES ====================

// GET promo
app.get('/api/promo', async (req, res) => {
    try {
        let promo = await Promo.findOne().lean();
        if (!promo) {
            // Return default promo if none exists
            promo = {
                tagText: 'Special Offer',
                title: 'Already have a quote?',
                description: 'We aim to beat any comparable written quotes by up to',
                highlightText: '15%',
                buttonText: 'Learn More',
                buttonLink: '#contact'
            };
        }
        res.json(promo);
    } catch (error) {
        console.error('Error fetching promo:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT update promo
app.put('/api/promo', async (req, res) => {
    try {
        let promo = await Promo.findOne();
        if (promo) {
            Object.assign(promo, req.body);
            await promo.save();
        } else {
            promo = await Promo.create(req.body);
        }
        res.json(promo);
    } catch (error) {
        console.error('Error updating promo:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== GALLERY ROUTES ====================

// GET all gallery items
app.get('/api/gallery', async (req, res) => {
    try {
        const items = await Gallery.find().sort({ createdAt: -1 }).lean();
        res.json(items);
    } catch (error) {
        console.error('Error fetching gallery:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST add gallery item
app.post('/api/gallery', async (req, res) => {
    try {
        const item = await Gallery.create(req.body);
        res.status(201).json(item);
    } catch (error) {
        console.error('Error adding gallery item:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST bulk sync gallery
app.post('/api/gallery/sync', async (req, res) => {
    try {
        const { items } = req.body;
        await Gallery.deleteMany({});
        const created = await Gallery.insertMany(items);
        res.json({ success: true, count: created.length });
    } catch (error) {
        console.error('Error syncing gallery:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE gallery item
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        await Gallery.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting gallery item:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
