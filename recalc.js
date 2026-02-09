const axios = require('axios');

async function rebuildGrades() {
    // ADJUST THIS DATE to your actual Term 3 start date
    const termStartDate = new Date('2026-01-01'); 
    
    console.log(`--- STARTING TERM 3 REBUILD (Post-${termStartDate.toLocaleDateString()}) ---`);
    try {
        const courses = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        for (const course of courses.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': 'assignment', 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let totalPoints = 0;
            let earnedPoints = 0;
            let itemsInTerm = 0;

            console.log(`\nChecking: ${course.name}`);

            subRes.data.forEach(s => {
                const assignmentDate = new Date(s.assignment?.created_at || s.assignment?.due_at);
                const max = s.assignment?.points_possible || 0;
                const score = s.score;

                // 1. FILTER BY DATE: Only count if assignment is from THIS term
                if (assignmentDate >= termStartDate) {
                    // 2. TOGGLE ON: Only count if it actually has a grade
                    if (max > 0 && score !== null && score !== undefined) {
                        earnedPoints += score;
                        totalPoints += max;
                        itemsInTerm++;
                        console.log(` [+] ${s.assignment.name} (${assignmentDate.toLocaleDateString()}): ${score}/${max}`);
                    }
                }
            });

            const final = totalPoints > 0 ? ((earnedPoints / totalPoints) * 100).toFixed(2) : "0.00";
            console.log(`>> TERM 3 TOTAL (${itemsInTerm} items): ${final}%`);
        }
    } catch (err) {
        console.error("Critical Error:", err.message);
    }
}

rebuildGrades();
