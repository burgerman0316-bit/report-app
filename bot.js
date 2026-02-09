const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- SYNCING TO 'GRADED ONLY' VIEW ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': ['assignment'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;

            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                
                // THE FIX: Only count points if there is a real score (Toggle = ON)
                // This ignores the "Missing" assignments that were tanking your grade to a D
                if (max > 0 && s.score !== null && s.score !== undefined) {
                    earned += s.score;
                    possible += max;
                }
            });

            const finalVal = possible > 0 ? ((earned / possible) * 100).toFixed(2) : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalVal}% (Ignoring Missing)`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas Sync" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `GRADED-ONLY REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Toggle ON: Ignoring Missing Work</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Graded-only sync sent.");
    } catch (error) { console.error(error.message); }
}
start();
