# Concepts

Plain-language explanations of every major concept used in this project. No assumed knowledge.

---

## What are we building?

A website where Moroccan users can:
1. Pick PC parts (CPU, GPU, RAM, etc.)
2. Get told instantly if the parts are compatible
3. Compare prices from Moroccan online stores
4. Click a link to buy from the cheapest store

The website does **not** sell anything. It is a comparator and advisor. It redirects users to retailer websites to complete purchases.

---

## Runtime

The engine that executes your code. Like how a car needs an engine to move, your JavaScript/TypeScript code needs a runtime to run.

- **Node.js** — the old standard. Works but slow.
- **Bun** — new runtime, 3–4× faster than Node.js. Built-in TypeScript, SQL client, test runner, and cron scheduler.

We run Bun inside **WSL2** (Windows Subsystem for Linux). Think of it like this: Windows is your house, WSL2 is a room that pretends to be a Linux apartment, and Bun lives in that apartment.

---

## Framework

A set of pre-built tools that makes building something easier. You could handle raw HTTP yourself, but a framework gives you routing, middleware, and request/response helpers.

- **Express** — old standard for Node.js. Slow and outdated.
- **Hono** — modern, fast, TypeScript-first. Runs natively on Bun.

---

## HTTP and REST API

**HTTP** is the protocol browsers and servers use to communicate. Every request has a method and a URL. Every response has a status code.

**REST API** is a convention for designing APIs using HTTP methods to represent actions:

| Method | Action | Example |
|---|---|---|
| GET | Read data | `GET /api/components` |
| POST | Create or submit | `POST /api/auth/login` |
| PUT | Update | `PUT /api/admin/components/:id` |
| DELETE | Delete | `DELETE /api/admin/components/:id` |

**HTTP status codes:**

| Code | Name | When |
|---|---|---|
| 200 | OK | Request succeeded |
| 201 | Created | Resource was created |
| 400 | Bad Request | Client sent invalid data |
| 401 | Unauthorized | Missing or invalid JWT token |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Something broke on the server |

---

## Middleware

A function that runs between receiving a request and sending a response. Think of it as a security guard at the door — they check your ID before letting you in.

In Hono:
```typescript
async function myMiddleware(c: Context, next: Next) {
  // Check something
  if (notOk) return c.json({ error: '...' }, 401); // stop the chain
  await next(); // pass to the next handler
}
```

This project uses two middleware functions:
- `authMiddleware` — verifies the JWT token
- `validateComponent` — validates the request body with Zod

---

## Service

A module that contains business logic — the rules of the application. Services don't know about HTTP or databases. They take data in and return a result.

This separation makes services easy to test in isolation. You can call `validateCompatibility(build)` directly in a test without starting a server.

---

## Database and SQL

A **database** stores data permanently. When you turn off the server, the data stays.

**SQL** (Structured Query Language) is the language used to talk to relational databases.

```sql
SELECT * FROM components WHERE category = 'cpu';
INSERT INTO components (name, category) VALUES ('Ryzen 7', 'cpu');
UPDATE components SET name = 'Ryzen 9' WHERE id = 1;
DELETE FROM components WHERE id = 1;
```

**Parameterized queries** prevent SQL injection by treating user input as data, never as SQL code:

```typescript
// Safe — ${category} is a parameter
const rows = await sql`SELECT * FROM components WHERE category = ${category}`;
```

---

## Zod and Validation

**Validation** is checking that incoming data is correct before using it. Users might send wrong types, missing fields, or invalid values.

**Zod** is a TypeScript library for defining schemas — rules that describe what valid data looks like:

```typescript
const cpuSchema = z.object({
  name: z.string().min(1),       // required string
  socket: z.string().min(1),     // required string
  tdp: z.number().optional(),    // optional number
});

const result = cpuSchema.safeParse(body);
// result.success = true/false
// result.error.issues = list of what failed
```

---

## JWT Authentication

**Authentication** = proving who you are.

**JWT (JSON Web Token)** is a signed string that proves identity. Think of it like a concert wristband:
1. You show your ticket at the entrance (login with username + password)
2. Staff gives you a wristband (the JWT token)
3. Every time you enter a restricted area, you show the wristband
4. Staff verify it's real without calling the entrance again

Structure: `header.payload.signature`

The server signs the token with a secret key. Anyone can read the payload, but only the server can create a valid signature.

---

## bcrypt

A one-way password hashing algorithm. Transforms a password into a scrambled string that cannot be reversed:

```
"mypassword" → "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHy"
```

When verifying: `bcrypt.compare("mypassword", hash)` → `true` or `false`

Passwords are never stored in plain text. If the database is ever compromised, hashes cannot be reversed.

---

## Dependency Injection

A pattern where a function receives its dependencies from the outside instead of creating them itself.

In `componentService.ts`, the SQL executor can be replaced in tests:

```typescript
let _sql = bunSql; // real database by default

export function setSql(mockSql) { _sql = mockSql; }  // inject mock in tests
export function resetSql() { _sql = bunSql; }         // restore after test
```

This means tests run without a real PostgreSQL server — the mock returns whatever the test needs.

---

## TDP (Thermal Design Power)

The maximum power a component consumes, measured in watts. Used to calculate the recommended PSU wattage.

Typical values:
- CPU: 65W–250W
- GPU: 100W–450W
- RAM: 5W–15W
- Storage: 2W–10W

The compatibility engine sums all TDPs and multiplies by 1.2 (20% safety margin) to get the minimum recommended PSU wattage.

---

## Unit Testing

Writing code that checks your code. Instead of manually testing every scenario, you write automated tests that run in seconds.

```typescript
test('AM5 CPU + LGA1700 motherboard → socket_mismatch error', () => {
  const result = validateCompatibility({
    cpu: { socket: 'AM5', tdp: 65 },
    motherboard: { socket: 'LGA1700', supported_ram_types: ['DDR5'], max_ram_frequency: 6000, tdp: 15 },
  });

  expect(result.errors[0].rule).toBe('socket_mismatch');
  expect(result.compatible).toBe(false);
});
```

If the function returns something different, the test fails and tells you exactly what was wrong.

---

## Property-Based Testing

Instead of one test with one specific input, you define a property that must hold for all inputs. `fast-check` generates hundreds of random inputs to try to break it.

Example property: "if CPU socket ≠ motherboard socket, then `compatible` must be false."

```typescript
fc.assert(fc.property(
  fc.string(), fc.string(),
  (cpuSocket, mbSocket) => {
    const result = validateCompatibility({ cpu: { socket: cpuSocket }, motherboard: { socket: mbSocket, ... } });
    return (cpuSocket !== mbSocket) === result.errors.some(e => e.rule === 'socket_mismatch');
  }
));
```

---

## UML Diagrams

Four standard diagram types used in this project:

| Type | What it shows |
|---|---|
| Use Case | Who uses the system and what they can do |
| Class | Code structure — classes, attributes, methods, relationships |
| Sequence | How objects interact over time for one specific scenario |
| Activity | Step-by-step flow of a process with decision branches |

See [../diagrams/README.md](../diagrams/README.md) for all diagram files.
