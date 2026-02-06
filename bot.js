const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Executing Weighted Logic Sync ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the Groups (Tests vs Homework) and their weights
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': 'assignments' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let totalWeightedScore = 0;
            let totalWeightUsed = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                // 2. Tally points within this specific weight group
                if (group.assignments) {
                    group.assignments.forEach(a => {
                        if (a.points_possible > 0) {
                            groupPossible += a.points_possible;
                            // Grab the real score or force 0 for missing work
                            groupEarned += (a.submission?.score || 0);
                        }
                    });
                }

                // 3. Apply the weight (e.g., Tests are 80% of the total)
                if (groupPossible > 0 && weight > 0) {
                    totalWeightedScore += (groupEarned / groupPossible) * weight;
                    totalWeightUsed += weight;
                }
            }

            // 4. Normalize to 100% scale
            let finalVal = totalWeightUsed > 0 
                ? (totalWeightedScore / (totalWeightUsed / 100)).toFixed(2) 
                : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalVal}% (Weights applied)`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `WEIGHTED SYNC: ${new Date().toLocaleDateString()}`,
            html: `<h3>Applying Teacher Weighting (80/20)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Weighted report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
