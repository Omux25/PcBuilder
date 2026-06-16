async function run() {
  const res = await fetch('https://pcbuilder-m2nf.onrender.com/api/pulse/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/test-pulse' })
  });
  console.log(res.status, await res.text());

  const res2 = await fetch('https://pcbuilder-m2nf.onrender.com/api/traffic/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: '/test-traffic' })
  });
  console.log(res2.status, await res2.text());
}
run();
