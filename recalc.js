const axios = require('axios');

async function rebuildGrades() {
    console.log("--- STARTING MANUAL GRADEBOOK REBUILD ---");
    try {
        const courses = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        for (const course of courses.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get every single submission for this class
            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': 'assignment', 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let totalPoints = 0;
            let earnedPoints = 0;

            console.log(`\nChecking: ${course.name}`);

            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                const score = s.score;

                // TOGGLE ON: This mimics the "Based on graded assignments" switch being ON
                if (max > 0 && score !== null && score !== undefined) {
                    earnedPoints += score;
                    totalPoints += max;
                    console.log(` + ${s.assignment.name}: ${score}/${max}`);
                }
            });

            const final = totalPoints > 0 ? ((earnedPoints / totalPoints) * 100).toFixed(2) : "0.00";
            console.log(`>> RECALCULATED SCORE: ${final}%`);
        }
    } catch (err) {
        console.error("Critical Error:", err.message);
    }
}

rebuildGrades();
