const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Stock Chinese flashcards
const flashcards = [
  { id: 1, chinese: '你好', pinyin: 'nǐ hǎo', english: 'hello', category: 'greetings' },
  { id: 2, chinese: '谢谢', pinyin: 'xièxie', english: 'thank you', category: 'greetings' },
  { id: 3, chinese: '再见', pinyin: 'zàijiàn', english: 'goodbye', category: 'greetings' },
  { id: 4, chinese: '对不起', pinyin: 'duìbuqǐ', english: 'sorry', category: 'greetings' },
  { id: 5, chinese: '是', pinyin: 'shì', english: 'yes / to be', category: 'basics' },
  { id: 6, chinese: '不', pinyin: 'bù', english: 'no / not', category: 'basics' },
  { id: 7, chinese: '我', pinyin: 'wǒ', english: 'I / me', category: 'basics' },
  { id: 8, chinese: '你', pinyin: 'nǐ', english: 'you', category: 'basics' },
  { id: 9, chinese: '他', pinyin: 'tā', english: 'he / him', category: 'basics' },
  { id: 10, chinese: '她', pinyin: 'tā', english: 'she / her', category: 'basics' },
  { id: 11, chinese: '水', pinyin: 'shuǐ', english: 'water', category: 'food' },
  { id: 12, chinese: '茶', pinyin: 'chá', english: 'tea', category: 'food' },
  { id: 13, chinese: '饭', pinyin: 'fàn', english: 'rice / meal', category: 'food' },
  { id: 14, chinese: '面', pinyin: 'miàn', english: 'noodles', category: 'food' },
  { id: 15, chinese: '一', pinyin: 'yī', english: 'one', category: 'numbers' },
  { id: 16, chinese: '二', pinyin: 'èr', english: 'two', category: 'numbers' },
  { id: 17, chinese: '三', pinyin: 'sān', english: 'three', category: 'numbers' },
  { id: 18, chinese: '四', pinyin: 'sì', english: 'four', category: 'numbers' },
  { id: 19, chinese: '五', pinyin: 'wǔ', english: 'five', category: 'numbers' },
  { id: 20, chinese: '爱', pinyin: 'ài', english: 'love', category: 'emotions' },
  { id: 21, chinese: '学习', pinyin: 'xuéxí', english: 'to study', category: 'verbs' },
  { id: 22, chinese: '工作', pinyin: 'gōngzuò', english: 'work / job', category: 'verbs' },
  { id: 23, chinese: '吃', pinyin: 'chī', english: 'to eat', category: 'verbs' },
  { id: 24, chinese: '喝', pinyin: 'hē', english: 'to drink', category: 'verbs' },
  { id: 25, chinese: '好的', pinyin: 'hǎo de', english: 'okay / good', category: 'basics' },
];

// Health check - no auth required
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get user info from user-service
async function getUserInfo(email) {
  try {
    const response = await fetch('http://user-service.apps.svc.cluster.local/api/users/me', {
      headers: { 'x-auth-request-user': email }
    });

    if (!response.ok) {
      console.error('Failed to fetch user info:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching user info:', error);
    return null;
  }
}

// Get current user with data from user-service
app.get('/api/me', async (req, res) => {
  const email = req.headers['x-auth-request-user'] || 'unknown';

  const userInfo = await getUserInfo(email);

  res.json({
    email,
    userInfo,
  });
});

// Get all flashcards
app.get('/api/flashcards', (req, res) => {
  res.json({ flashcards });
});

// Get flashcards by category
app.get('/api/flashcards/category/:category', (req, res) => {
  const { category } = req.params;
  const filtered = flashcards.filter(card => card.category === category);
  res.json({ flashcards: filtered });
});

// Get random flashcard
app.get('/api/flashcards/random', (req, res) => {
  const randomCard = flashcards[Math.floor(Math.random() * flashcards.length)];
  res.json(randomCard);
});

// Get all categories
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(flashcards.map(card => card.category))];
  res.json({ categories });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
