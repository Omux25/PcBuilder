import jwt from 'jsonwebtoken';

const secret = 'dev-secret-key-change-in-production-min32';
const token = jwt.sign({ id: 1, username: 'admin' }, secret, { expiresIn: '1h' });

console.log("Generated JWT Token:", token);

try {
  console.log("Making fetch request to http://localhost:3000/api/admin/logs?limit=100...");
  const res = await fetch('http://localhost:3000/api/admin/logs?limit=100', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  console.log("Response Status:", res.status);
  const data = await res.json();
  console.log("Returned Logs Count:", data.logs?.length);
  if (data.logs && data.logs.length > 0) {
    console.log("Newest log in API:", data.logs[0]);
    console.log("Oldest log in API:", data.logs[data.logs.length - 1]);
  } else {
    console.log("Response data:", data);
  }
} catch (e) {
  console.error("Error fetching from API:", e);
}
