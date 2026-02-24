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
    status: 'PASS' | 'FAIL';
    message: string;
    statusCode?: number;
}

const results: TestResult[] = [];

async function runTest(category: string, testName: string, fn: () => Promise<void>) {
    try {
        await fn();
        results.push({ category, test: testName, status: 'PASS', message: 'OK' });
        console.log(`${colors.green}✔ PASS: ${testName}${colors.reset}`);
    } catch (error: any) {
        const statusCode = error.response?.status;
        const errorMsg = error.response?.data?.message || (error.response?.data?.error ? JSON.stringify(error.response.data.error) : error.message);
        results.push({ category, test: testName, status: 'FAIL', message: errorMsg, statusCode });
        console.log(`${colors.red}✘ FAIL: ${testName} (${errorMsg})${colors.reset}`);
    }
}

async function startTests() {
    console.log(`${colors.cyan}${colors.bright}=== News API Article Management Test Suite ===${colors.reset}\n`);

    // SETUP: Create two authors
    const author1 = {
        name: "Author One",
        email: `author1-${Date.now()}@test.com`,
        password: "Password123!",
        role: "AUTHOR"
    };
    const author2 = {
        name: "Author Two",
        email: `author2-${Date.now()}@test.com`,
        password: "Password123!",
        role: "AUTHOR"
    };

    let token1 = "";
    let token2 = "";

    console.log(`${colors.bright}0. SETUP (AUTH)${colors.reset}`);
    await axios.post(`${API_URL}/auth/signup`, author1);
    const login1 = await axios.post(`${API_URL}/auth/login`, { email: author1.email, password: author1.password });
    token1 = login1.data.data.token;

    await axios.post(`${API_URL}/auth/signup`, author2);
    const login2 = await axios.post(`${API_URL}/auth/login`, { email: author2.email, password: author2.password });
    token2 = login2.data.data.token;

    // 1. AUTHENTICATION REQUIRED
    console.log(`\n${colors.bright}1. AUTHENTICATION REQUIRED${colors.reset}`);
    await runTest("AUTH", "Create article without token", async () => {
        try {
            await axios.post(`${API_URL}/articles`, { title: "Title", content: "Content..." });
            throw new Error("Should have failed");
        } catch (e: any) {
            if (e.response?.status !== 401) throw new Error(`Expected 401, got ${e.response?.status}`);
        }
    });

    // 2. POST /articles
    console.log(`\n${colors.bright}2. POST /ARTICLES (CREATION & VALIDATION)${colors.reset}`);
    let article1Id = "";

    await runTest("VALIDATION", "Create with multi-word title and valid content", async () => {
        const content = "This is a very long content string that exceeds the fifty characters limit required for validation.".repeat(2);
        const res = await axios.post(
            `${API_URL}/articles`,
            { title: "My First Senior Article", content },
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        article1Id = res.data.data.id;
        if (res.data.data.status !== 'DRAFT') throw new Error("Status should default to DRAFT");
    });

    await runTest("VALIDATION", "Invalid title (empty)", async () => {
        try {
            await axios.post(
                `${API_URL}/articles`,
                { title: "", content: "Valid content".repeat(10) },
                { headers: { Authorization: `Bearer ${token1}` } }
            );
            throw new Error("Should have failed");
        } catch (e: any) {
            if (e.response?.status !== 400) throw new Error(`Expected 400, got ${e.response?.status}`);
        }
    });

    await runTest("VALIDATION", "Invalid content (<50 chars)", async () => {
        try {
            await axios.post(
                `${API_URL}/articles`,
                { title: "Valid Title", content: "Too short" },
                { headers: { Authorization: `Bearer ${token1}` } }
            );
            throw new Error("Should have failed");
        } catch (e: any) {
            if (e.response?.status !== 400) throw new Error(`Expected 400, got ${e.response?.status}`);
        }
    });

    // 3. GET /articles/me
    console.log(`\n${colors.bright}3. GET /ARTICLES/ME (AUTHOR VIEW)${colors.reset}`);
    await runTest("ME", "Get list of author's articles with pagination", async () => {
        const res = await axios.get(`${API_URL}/articles/me?page=1&limit=5`, {
            headers: { Authorization: `Bearer ${token1}` }
        });
        if (!Array.isArray(res.data.data)) throw new Error("Expected array of articles");
        if (res.data.data.length === 0) throw new Error("Author should have at least 1 article");
    });

    await runTest("ME", "Soft-deleted articles NOT shown by default", async () => {
        // Create and then delete an article
        const tempRes = await axios.post(
            `${API_URL}/articles`,
            { title: "To Be Deleted", content: "Some content".repeat(10) },
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        const tempId = tempRes.data.data.id;
        await axios.delete(`${API_URL}/articles/${tempId}`, { headers: { Authorization: `Bearer ${token1}` } });

        const res = await axios.get(`${API_URL}/articles/me`, { headers: { Authorization: `Bearer ${token1}` } });
        const exists = res.data.data.some((a: any) => a.id === tempId);
        if (exists) throw new Error("Soft-deleted article should not appear by default");
    });

    // 4. PUT /articles/:id
    console.log(`\n${colors.bright}4. PUT /ARTICLES/:ID (UDATE & AUTHZ)${colors.reset}`);
    await runTest("UPDATE", "Update own article", async () => {
        const res = await axios.put(
            `${API_URL}/articles/${article1Id}`,
            { title: "Updated Title" },
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        if (res.data.data.title !== "Updated Title") throw new Error("Title not updated");
    });

    await runTest("AUTHZ", "Try updating someone else's article", async () => {
        try {
            await axios.put(
                `${API_URL}/articles/${article1Id}`,
                { title: "Hacked Title" },
                { headers: { Authorization: `Bearer ${token2}` } }
            );
            throw new Error("Should have failed");
        } catch (e: any) {
            // Expect 403 or 400 (Unauth)
            if (e.response?.status !== 400 && e.response?.status !== 403)
                throw new Error(`Expected 400/403, got ${e.response?.status}`);
        }
    });

    // 5. DELETE /articles/:id
    console.log(`\n${colors.bright}5. DELETE /ARTICLES/:ID (SOFT DELETE)${colors.reset}`);
    await runTest("DELETE", "Soft delete own article", async () => {
        const res = await axios.delete(
            `${API_URL}/articles/${article1Id}`,
            { headers: { Authorization: `Bearer ${token1}` } }
        );
        if (!res.data.success) throw new Error("Delete failed");
    });

    await runTest("VISIBILITY", "Deleted article NOT in public feed", async () => {
        const res = await axios.get(`${API_URL}/articles`);
        const exists = res.data.data.some((a: any) => a.id === article1Id);
        if (exists) throw new Error("Deleted article should not be in public feed");
    });

    await runTest("AUTHZ", "Try deleting someone else's article", async () => {
        try {
            // Create an article for author 2 first
            const res = await axios.post(
                `${API_URL}/articles`,
                { title: "Author 2 Art", content: "Content".repeat(20) },
                { headers: { Authorization: `Bearer ${token2}` } }
            );
            const art2Id = res.data.data.id;

            // Author 1 tries to delete it
            await axios.delete(`${API_URL}/articles/${art2Id}`, { headers: { Authorization: `Bearer ${token1}` } });
            throw new Error("Should have failed");
        } catch (e: any) {
            if (e.response?.status !== 400 && e.response?.status !== 403)
                throw new Error(`Expected 400/403, got ${e.response?.status}`);
        }
    });

    // FINAL REPORT
    console.log(`\n${colors.cyan}${colors.bright}=== Final Article Management Test Report ===${colors.reset}`);
    console.table(results.map(r => ({
        Category: r.category,
        Test: r.test,
        Status: r.status,
        "Status Code": r.statusCode || "-",
        Notes: r.message
    })));

    const failCount = results.filter(r => r.status === 'FAIL').length;
    if (failCount > 0) {
        console.log(`\n${colors.red}${colors.bright}TEST SUITE FAILED: ${failCount} errors found.${colors.reset}`);
    } else {
        console.log(`\n${colors.green}${colors.bright}TEST SUITE PASSED SUCCESSFULLY!${colors.reset}`);
    }
}

// Check if server is reachable
axios.get(API_URL).catch(() => {
    console.error(`\n${colors.red}${colors.bright}ERROR: API server is not running at ${API_URL}${colors.reset}`);
    process.exit(1);
}).then(() => startTests().catch(console.error));
