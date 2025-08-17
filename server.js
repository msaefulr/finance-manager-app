// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Koneksi ke MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Berhasil terhubung ke MongoDB Atlas'))
  .catch(err => console.error('Gagal terhubung ke MongoDB Atlas:', err));

// Skema dan Model
const transactionSchema = new mongoose.Schema({
  date: String,
  dateISO: String,
  type: String,
  amount: Number,
  description: String,
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

// ---- API ENDPOINTS ----

// GET: Mengambil semua transaksi
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: 1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST: Menambah transaksi baru
app.post('/api/transactions', async (req, res) => {
  const transaction = new Transaction({
    date: req.body.date,
    dateISO: req.body.dateISO,
    type: req.body.type,
    amount: req.body.amount,
    description: req.body.description,
  });
  try {
    const newTransaction = await transaction.save();
    res.status(201).json(newTransaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT: Mengubah transaksi
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
    }
    transaction.date = req.body.date || transaction.date;
    transaction.dateISO = req.body.dateISO || transaction.dateISO;
    transaction.type = req.body.type || transaction.type;
    transaction.amount = req.body.amount || transaction.amount;
    transaction.description = req.body.description || transaction.description;

    const updatedTransaction = await transaction.save();
    res.json(updatedTransaction);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE: Menghapus satu transaksi
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await Transaction.findByIdAndDelete(req.params.id);
    res.json({ message: 'Transaksi berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE: Menghapus semua transaksi
app.delete('/api/transactions', async (req, res) => {
  try {
    await Transaction.deleteMany({});
    res.json({ message: 'Semua transaksi berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Server mulai
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});