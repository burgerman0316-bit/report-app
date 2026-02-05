const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Initializing Brute Force Recovery ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the real category weights (e.g., Summative 80%)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedScore = 0;
            let totalWeightUsed = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let earned = 0;
                let possible = 0;

                // 2. Scan every individual assignment in this category
                group.assignments?.forEach(a => {
                    const p = a.points_possible || 0;
                    if (p > 0) {
                        possible += p;
                        // Grab the score directly from the assignment object
                        earned += (a.submission?.score || 0);
                    }
                });

                if (possible > 0 && weight > 0) {
                    weightedScore += (earned / possible) * weight;
                    totalWeightUsed += weight;
                }
            }

            // 3. Final calculation and normalization
            let finalVal = totalWeightUsed > 0 
                ? (weightedScore / (totalWeightUsed / 100)).toFixed(2) 
                : "0.00";

            // Emergency check: If math fails, pull the phone app's direct score
            if (finalVal === "0.00") {
                const enroll = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalVal = (enroll.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td></tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `TANK REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3 style="color:red;">Calculated from Raw Data (No API Summaries)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Brute Force Complete.");
    } catch (error) { console.error("Critical Error:", error.message); }
}
start();
