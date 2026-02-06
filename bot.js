const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Executing Nuclear Submission Scan ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // This hits the specific endpoint for YOUR submissions
            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'per_page': 100, 'include[]': ['assignment'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;

            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                if (max > 0) {
                    possible += max;
                    // If score is null, it's a 0 (The Hogan Penalty)
                    earned += (s.score !== null && s.score !== undefined) ? s.score : 0;
                }
            });

            let finalVal = possible > 0 ? ((earned / possible) * 100).toFixed(2) : "N/A";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalVal}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas NuclearBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `NUCLEAR REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Raw Submission Point Tally (Bypassing All Blocks)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Nuclear Sync Sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
