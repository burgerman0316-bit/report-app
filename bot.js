const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Forcing Missing Work to Zero ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

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
                        // THE FIX: If score is null or submission is missing, it's a 0.
                        const score = a.submission?.score;
                        if (score !== null && score !== undefined) {
                            earned += score;
                        } else {
                            earned += 0; // Force the 0 penalty
                        }
                    }
                });

                if (possible > 0 && weight > 0) {
                    weightedSum += (earned / possible) * weight;
                    totalWeight += weight;
                }
            });

            let finalGrade = totalWeight > 0 ? (weightedSum / (totalWeight / 100)).toFixed(2) : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}%</b></td>
                     </tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `TRUE ZERO REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Missing Assignments Forced to 0%</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ True Zero calculation sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
