const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Simple Math Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get every assignment for the course
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let totalEarned = 0;
            let totalPossible = 0;

            assignRes.data.forEach(a => {
                const possible = a.points_possible || 0;
                if (possible > 0) {
                    totalPossible += possible;
                    // Force 0 for missing/unsubmitted to match Hogan's 64.71%
                    totalEarned += (a.submission?.score || 0);
                }
            });

            // 2. The Simple Math Fix: (Earned / Possible) * 100
            let finalPercent = totalPossible > 0 
                ? ((totalEarned / totalPossible) * 100).toFixed(2) 
                : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalPercent}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalPercent}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Simple Math Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Raw Point Totals (Percentage Fix)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Simple math report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
