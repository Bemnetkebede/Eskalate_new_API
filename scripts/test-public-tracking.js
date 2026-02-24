import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();
// Local prisma instance for the test script to avoid ESM import chain issues
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});
const API_URL = `http://localhost:${process.env.PORT || 3000}`;
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    bright: "\x1b[1m",
};
const results = [];
async function runTest(category, testName, fn) {
    const start = Date.now();
    try {
        await fn();
        const duration = Date.now() - start;
        results.push({ category, test: testName, status: 'PASS', message: 'OK', duration });
        console.log(`${colors.green}✔ PASS: ${testName} (${duration}ms)${colors.reset}`);
    }
    catch (error) {
        const errorMsg = error.response?.data?.message || (error.response?.data?.error ? JSON.stringify(error.response.data.error) : error.message);
        results.push({ category, test: testName, status: 'FAIL', message: errorMsg });
        console.log(`${colors.red}✘ FAIL: ${testName} (${errorMsg})${colors.reset}`);
    }
}
async function startTests() {
    console.log(`${colors.cyan}${colors.bright}=== News API Public Feed & Tracking Test ===${colors.reset}\n`);
    // SETUP: Create an Author and a Published Article
    console.log(`${colors.bright}0. SETUP${colors.reset}`);
    const authorData = {
        name: "Senior Tester",
        email: `tester-${Date.now()}@test.com`,
        password: "Password123!",
        role: "AUTHOR"
    };
    await axios.post(`${API_URL}/auth/signup`, authorData);
    const loginRes = await axios.post(`${API_URL}/auth/login`, { email: authorData.email, password: authorData.password });
    const token = loginRes.data.data.token;
    const authorId = loginRes.data.data.user.id;
    const resArt = await axios.post(`${API_URL}/articles`, {
        title: "Senior Testing: Advanced Analytics",
        content: "This is a comprehensive article about how to test high-performance news APIs with fire-and-forget logic.".repeat(2),
        category: "Tech",
        status: "PUBLISHED"
    }, { headers: { Authorization: `Bearer ${token}` } });
    const articleId = resArt.data.data.id;
    // 1. GET /articles (PUBLIC FEED)
    console.log(`\n${colors.bright}1. PUBLIC FEED VALIDATION${colors.reset}`);
    await runTest("FEED", "Filter by Category (Exact)", async () => {
        const res = await axios.get(`${API_URL}/articles?category=Tech`);
        if (res.data.data.length === 0)
            throw new Error("Category filter returned nothing");
        if (res.data.data[0].category !== 'Tech')
            throw new Error("Incorrect category returned");
    });
    await runTest("FEED", "Filter by Author (Partial Match)", async () => {
        const res = await axios.get(`${API_URL}/articles?author=Tester`);
        if (res.data.data.length === 0)
            throw new Error("Author filter returned nothing");
    });
    await runTest("FEED", "Keyword Search (q=Analytics)", async () => {
        const res = await axios.get(`${API_URL}/articles?q=Analytics`);
        if (res.data.data.length === 0)
            throw new Error("Keyword search returned nothing");
    });
    await runTest("FEED", "Verify PaginatedResponse format", async () => {
        const res = await axios.get(`${API_URL}/articles`);
        if (res.data.meta === undefined)
            throw new Error("Meta pagination field missing");
        if (res.data.meta.total === undefined)
            throw new Error("Total count missing");
    });
    // 2. GET /articles/:id (READ TRACKING)
    console.log(`\n${colors.bright}2. READ TRACKING VALIDATION${colors.reset}`);
    await runTest("TRACKING", "Guest Read (No Token) creates ReadLog with NULL userId", async () => {
        const beforeCount = await prisma.readLog.count();
        await axios.get(`${API_URL}/articles/${articleId}`);
        // Delay slightly to allow fire-and-forget to settle
        await new Promise(r => setTimeout(r, 800));
        const afterCount = await prisma.readLog.count();
        if (afterCount <= beforeCount)
            throw new Error("ReadLog not incremented");
        const latest = await prisma.readLog.findFirst({ orderBy: { createdAt: 'desc' } });
        if (latest.userId !== null)
            throw new Error(`Expected NULL userId, got ${latest.userId}`);
    });
    await runTest("TRACKING", "Authenticated Read creates ReadLog with userId", async () => {
        const beforeCount = await prisma.readLog.count();
        await axios.get(`${API_URL}/articles/${articleId}`, { headers: { Authorization: `Bearer ${token}` } });
        await new Promise(r => setTimeout(r, 800));
        const afterCount = await prisma.readLog.count();
        const latest = await prisma.readLog.findFirst({ orderBy: { createdAt: 'desc' } });
        if (latest.userId !== authorId)
            throw new Error(`Expected userId ${authorId}, got ${latest.userId}`);
    });
    // 3. CONCURRENCY TEST
    console.log(`\n${colors.bright}3. CONCURRENCY VALIDATION${colors.reset}`);
    await runTest("CONCURRENCY", "5 simultaneous requests are non-blocking", async () => {
        const start = Date.now();
        await Promise.all([
            axios.get(`${API_URL}/articles/${articleId}`),
            axios.get(`${API_URL}/articles/${articleId}`),
            axios.get(`${API_URL}/articles/${articleId}`),
            axios.get(`${API_URL}/articles/${articleId}`),
            axios.get(`${API_URL}/articles/${articleId}`)
        ]);
        const duration = Date.now() - start;
        console.log(`    Total duration for 5 reads: ${duration}ms`);
        // Threshold adjusted for local dev environment latency
        if (duration > 1500)
            throw new Error("Requests took too long, might be blocking");
    });
    // 4. BONUS - ANTI-REFRESH
    console.log(`\n${colors.bright}4. BONUS (ANTI-REFRESH)${colors.reset}`);
    await runTest("BONUS", "10 rapid requests from same IP only log a few (30s window)", async () => {
        const initialCount = await prisma.readLog.count();
        const tasks = [];
        for (let i = 0; i < 10; i++)
            tasks.push(axios.get(`${API_URL}/articles/${articleId}`));
        await Promise.all(tasks);
        await new Promise(r => setTimeout(r, 1000));
        const finalCount = await prisma.readLog.count();
        const diff = finalCount - initialCount;
        console.log(`    Requested: 10, Logged: ${diff}`);
        if (diff > 2)
            throw new Error(`Expected minimal logging (1 or 2), got ${diff}`);
        results[results.length - 1].status = 'BONUS';
    });
    // FINAL REPORT
    console.log(`\n${colors.cyan}${colors.bright}=== Public Feed & Tracking Report ===${colors.reset}`);
    console.table(results.map(r => ({
        Test: r.test,
        Status: r.status,
        Result: r.message,
        Time: r.duration ? `${r.duration}ms` : "-"
    })));
    await prisma.$disconnect();
}
startTests().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
