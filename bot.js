const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Executing Submission-Level Override ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get ONLY the submissions for you in this course
            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'per_page': 100, 'include[]': ['assignment'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let ptsEarned = 0;
            let ptsPossible = 0;

            // 2. Add up every score we find in the submission history
            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                if (max > 0) {
                    ptsPossible += max;
                    // If the score is null, it counts as 0 (The Hogan Penalty)
                    ptsEarned += (s.score || 0);
                }
            });

            // 3. Raw calculation (Earned / Possible)
            let finalVal = ptsPossible > 0 
                ? ((ptsEarned / ptsPossible) * 100).toFixed(2) 
                : "0.00";

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
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `SUBMISSION OVERRIDE: ${new Date().toLocaleDateString()}`,
            html: `<h3>Bypassing Dashboard Locks via Submission History</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Override report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
