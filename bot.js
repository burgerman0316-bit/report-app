const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Bypassing Groups: Raw Submission Stream ---");
    try {
        // 1. Get the list of active courses
        const coursesRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of coursesRes.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 2. Get the RAW submission stream for this specific course
            // This bypasses the "Assignment Group" locks that caused the 0.00%
            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': ['assignment'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;

            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                if (max > 0) {
                    possible += max;
                    // Force 0 for missing work (The Hogan/Math penalty)
                    earned += (s.score !== null && s.score !== undefined) ? s.score : 0;
                }
            });

            // 3. Calculate raw percentage
            const percent = possible > 0 ? ((earned / possible) * 100).toFixed(2) : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${percent}%</b></td>
                     </tr>`;
            console.log(`Streamed ${course.name}: ${percent}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas StreamBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `STREAM REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3 style="color:blue;">Raw Submission Stream (No Groups)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Stream Sync complete.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
