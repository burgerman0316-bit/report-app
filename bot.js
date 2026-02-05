const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Sniper Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get ONLY the assignments for this course
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 50 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let ptsEarned = 0;
            let ptsPossible = 0;

            // 2. Add up every single point we can find
            assignRes.data.forEach(a => {
                const max = a.points_possible || 0;
                if (max > 0) {
                    ptsPossible += max;
                    // Force 0 if missing. If Hogan has 1 assignment, this grabs it.
                    ptsEarned += (a.submission?.score || 0);
                }
            });

            // 3. Raw Math: (Earned / Possible) * 100
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
            subject: `Sniper Match Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Raw Score Only Match</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Sniper report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
