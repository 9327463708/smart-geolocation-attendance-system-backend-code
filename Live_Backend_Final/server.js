const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const supabase = require('./supabaseClient');

const PORT = process.env.PORT || 5000;

// Test Supabase Connection
(async () => {
  const { data, error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error('Supabase connection error:', error.message);
  } else {
    console.log('Supabase connected successfully');
  }
})();

app.get('/', (req, res) => {
  res.send('College Attendance API is running...');
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/users', require('./routes/users'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/timetables', require('./routes/timetables'));

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
