const axios = require('axios');

async function discover() {
    console.log("--- HUNTING FOR THE TRUTH ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'include[]': ['total_scores'], 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        const hogan = res.data.find(c => c.name && c.name.toLowerCase().includes("hogan"));

        if (hogan) {
            console.log(`\n--- DATA DUMP FOR: ${hogan.name} ---`);
            // This shows exactly what the server thinks your grade is
            console.log(JSON.stringify(hogan.enrollments[0].grades, null, 2));
            
            console.log("\n--- CHECKING ASSIGNMENT GROUPS ---");
            const groups = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${hogan.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });
            console.log(JSON.stringify(groups.data, null, 2));
        } else {
            console.log("Couldn't even find Hogan's class. Check your API key permissions.");
        }
    } catch (error) {
        console.error("Error:", error.message);
    }
}
discover();
