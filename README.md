# News API - Advanced Backend Implementation

A high-performance, modular News API built with Node.js, TypeScript, and Prisma. This project was designed for the A2SV Eskalate Assessment, focusing on scalability, strict data integrity, and non-blocking analytics.

## 🚀 Key Architectural Decisions

### 1. High-Availability Analytics (The "Senior" Difference)
To ensure that recording article views (ReadLogs) never impacts the reader's experience, I implemented an **Asynchronous Event-Driven Architecture** using the Node.js `EventEmitter`.

- **Trade-off**: I made the intentional decision to sacrifice **Immediate Consistency** for **High Availability**.
- **Rationale**: In a high-traffic news platform, a reader should not wait for a database write operation to complete before receiving their article content. By emitting a `trackRead` event and immediately returning the article payload, the API remains extremely responsive.
- **Deduplication**: To prevent view inflation from accidental refreshes or spam, I implemented an in-memory sliding window cache. Reads from the same User/IP for the same Article within a 30-second window are silently discarded.

### 2. Precise GMT Analytics Aggregation
Aggregation of raw read logs into the `DailyAnalytics` table is handled by a background cron job optimized for PostgreSQL 18.2.

- **Timezone Handling**: To maintain a single source of truth for daily data regardless of the user's local timezone, all aggregation logic is strictly pinned to **GMT (UTC)**.
- **Implementation**: The collector uses `setUTCHours(0, 0, 0, 0)` on the current date object to calculate the boundaries of "yesterday" in UTC. This ensures that the composite unique index `[articleId, date]` in PostgreSQL remains deterministic and overlaps are impossible.
- **Upsert Strategy**: The job uses a high-concurrency `upsert` strategy to ensure that even if the job is manually re-triggered, view counts are corrected without duplicating records.

### 3. Data Integrity & Global Soft Delete
- **Soft Deletion**: Articles and Users utilize a `deletedAt` timestamp. This preserves data for audit trails and analytics while shielding them from application logic.
- **Manual Filtering**: Services are structured to always filter queries by `deletedAt: null`, ensuring that a "Deleted" article never appears in the public feed or counts toward active totals.

---

## 🛠️ Technology Stack
- **Runtime**: Node.js (ECCMAScript Modules)
- **Language**: TypeScript (Strict Mode)
- **Database**: PostgreSQL 18.2
- **ORM**: Prisma 7.x
- **Auth**: JWT & Argon2
- **Validation**: Zod

---

## 🏁 Getting Started

### Prerequisites
- Node.js installed
- PostgreSQL 18.2 instance running

### Installation
1. **Clone the repository** and navigate to the project root.
2. **Setup Environment**: Create a `.env` file with the following:
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/news_api"
   JWT_SECRET="your-secure-32-character-secret"
   PORT=3000
   ```
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Push Schema & Generate Client**:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. **Start the API**:
   ```bash
   npm run dev
   ```

---

## 📂 Project Structure
- `src/core`: Shared utilities, config, and the Analytics EventEmitter.
- `src/modules`: Feature-based logic (Auth, Articles).
- `src/middlewares`: Global and route-specific logic (e.g., JWT Auth).
- `src/jobs`: Background processing (Daily Aggregator).
- `src/lib`: Third-party service clients (Prisma Singleton).

---

## 📜 Eskalate JSON Response Contract
All endpoints return a consistent JSON payload:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```
For paginated results:
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10
  }
}
```