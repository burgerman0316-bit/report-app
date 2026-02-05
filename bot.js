const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Manual Weight Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get assignment groups to find 80% Summative / 20% Formative
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let totalWeight = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                let earned = 0;
                let possible = 0;

                group.assignments?.forEach(a => {
                    const p = a.points_possible || 0;
                    if (p > 0) {
                        possible += p;
                        // Force missing assignments to count as 0
                        earned += (a.submission?.score || 0);
                    }
                });

                if (possible > 0 && weight > 0) {
                    weightedSum += (earned / possible) * weight;
                    totalWeight += weight;
                }
            });

            // 2. Final Math
            let finalGrade = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : "N/A";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalGrade}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Dashboard Match Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>80/20 Manual Match</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Manual calculation sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
