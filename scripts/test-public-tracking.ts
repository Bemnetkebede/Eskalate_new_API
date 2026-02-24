import axios from 'axios';

const API_URL = `http://localhost:${process.env.PORT || 3000}`;

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    bright: "\x1b[1m",
};

interface TestResult {
    category: string;
    test: string;
    status: 'PASS' | 'FAIL' | 'BONUS';
    message: string;
    duration?: number;
}

const results: TestResult[] = [];

async function runTest(category: string, testName: string, fn: () => Promise<void>) {
    const start = Date.now();
    try {
        await fn();
        const duration = Date.now() - start;
        results.push({ category, test: testName, status: 'PASS', message: 'OK', duration });
        console.log(`${colors.green}✔ PASS: ${testName} (${duration}ms)${colors.reset}`);
    } catch (error: any) {
        const errorMsg = error.response?.data?.message || (error.response?.data?.error ? JSON.stringify(error.response.data.error) : error.message);
        results.push({ category, test: testName, status: 'FAIL', message: errorMsg });
        console.log(`${colors.red}✘ FAIL: ${testName} (${errorMsg})${colors.reset}`);
    }
}

async function startTests() {
    console.log(`${colors.cyan}${colors.bright}=== News API Public Feed & Tracking Test ===${colors.reset}\n`);

    // SETUP: Create an Author and a Published Article
    console.log(`${colors.bright}0. SETUP${colors.reset}`);
    const uniqueId = Date.now();
    const authorData = {
        name: "Senior Tester",
        email: `tester-${uniqueId}@test.com`,
        password: "Password123!",
        role: "AUTHOR"
    };

    try {
        console.log("    Signing up author...");
        await axios.post(`${API_URL}/auth/signup`, authorData);

        console.log("    Logging in author...");
        const loginRes = await axios.post(`${API_URL}/auth/login`, { email: authorData.email, password: authorData.password });
        const token = loginRes.data.data.token;
        const authorId = loginRes.data.data.user.id;

        console.log("    Creating published article...");
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
            if (res.data.data.length === 0) throw new Error("Category filter returned nothing");
            if (res.data.data[0].category !== 'Tech') throw new Error("Incorrect category returned");
        });

        await runTest("FEED", "Filter by Author (Partial Match)", async () => {
            const res = await axios.get(`${API_URL}/articles?author=Tester`);
            if (res.data.data.length === 0) throw new Error("Author filter returned nothing");
        });

        await runTest("FEED", "Keyword Search (q=Analytics)", async () => {
            const res = await axios.get(`${API_URL}/articles?q=Analytics`);
            if (res.data.data.length === 0) throw new Error("Keyword search returned nothing");
        });

        await runTest("FEED", "Verify PaginatedResponse format", async () => {
            const res = await axios.get(`${API_URL}/articles`);
            if (res.data.meta === undefined) throw new Error("Meta pagination field missing");
        });

        // 2. GET /articles/:id (READ TRACKING)
        console.log(`\n${colors.bright}2. READ TRACKING VALIDATION${colors.reset}`);

        await runTest("TRACKING", "Guest Read (No Token) - Success response", async () => {
            const res = await axios.get(`${API_URL}/articles/${articleId}`);
            if (!res.data.success) throw new Error("API failed read");
        });

        await runTest("TRACKING", "Authenticated Read - Success response", async () => {
            const res = await axios.get(`${API_URL}/articles/${articleId}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.data.success) throw new Error("API failed read");
        });

        await runTest("TRACKING", "Deleted article returns 404 (Descriptive)", async () => {
            const temp = await axios.post(`${API_URL}/articles`, { title: "Temp", content: "Content".repeat(10) }, { headers: { Authorization: `Bearer ${token}` } });
            const tempId = temp.data.data.id;
            await axios.delete(`${API_URL}/articles/${tempId}`, { headers: { Authorization: `Bearer ${token}` } });

            try {
                await axios.get(`${API_URL}/articles/${tempId}`);
                throw new Error("Should have 404ed");
            } catch (e: any) {
                if (e.response?.status !== 404) throw new Error(`Expected state 404, got ${e.response?.status}`);
                if (e.response?.data?.message !== "News article no longer available")
                    throw new Error(`Expected specific message, got ${e.response?.data?.message}`);
            }
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
            if (duration > 1500) throw new Error("Requests took too long");
        });

        // 4. BONUS - ANTI-REFRESH
        console.log(`\n${colors.bright}4. BONUS (ANTI-REFRESH)${colors.reset}`);
        await runTest("BONUS", "Burst protection verified (No API failures)", async () => {
            const tasks = [];
            for (let i = 0; i < 10; i++) tasks.push(axios.get(`${API_URL}/articles/${articleId}`));
            await Promise.all(tasks);
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

    } catch (error: any) {
        console.error("Setup failed!");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data));
        } else {
            console.error("Message:", error.message);
        }
        process.exit(1);
    }
}

startTests().catch(console.error);
