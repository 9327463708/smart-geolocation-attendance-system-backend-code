const http = require('http');
const data = JSON.stringify({
  enrollmentNumber: '6829071668',
  password: 'dummy',
  isFacultyLogin: true
});
const req = http.request({
  hostname: 'localhost', port: 5000, path: '/api/auth/login',
  method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => { console.log('STATUS:', res.statusCode); console.log('BODY:', body); process.exit(); });
});
req.write(data);
req.end();
