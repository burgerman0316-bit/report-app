const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- FINAL ATTEMPT: MANUAL WEIGHTED RECOVERY ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get Weighting Groups AND Assignments for this class
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedTotal = 0;
            let totalWeightPossible = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let earned = 0;
                let possible = 0;

                // 2. Tally every single point in the group
                if (group.assignments) {
                    for (const a of group.assignments) {
                        const pts = a.points_possible || 0;
                        if (pts > 0) {
                            possible += pts;
                            // Grab score or force 0 if null/missing
                            const score = (a.submission && a.submission.score !== null) ? a.submission.score : 0;
                            earned += score;
                        }
                    }
                }

                // 3. Apply the Weight (e.g., if you have 80/100 in an 80% category)
                if (possible > 0 && weight > 0) {
                    weightedTotal += (earned / possible) * weight;
                    totalWeightPossible += weight;
                }
            }

            // 4. Normalize to 100% (Avoids the NaN% error)
            let finalPercent = totalWeightPossible > 0 
                ? (weightedTotal / (totalWeightPossible / 100)).toFixed(2) 
                : "0.00";

            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalPercent}%</b></td></tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `MANUAL RECOVERY: ${new Date().toLocaleDateString()}`,
            html: `<h3 style="color:red;">Force-Calculated Weighted Grades</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Manual Recovery Sent.");
    } catch (error) { console.error(error.message); }
}
start();
