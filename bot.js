const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- STARTING FORENSIC DATA RECOVERY ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;
            
            console.log(`\n--- COURSE: ${course.name} ---`);

            // Pull raw submissions for the specific course
            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': 'assignment', 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;
            let gradedCount = 0;

            subRes.data.forEach(s => {
                const max = s.assignment?.points_possible || 0;
                const score = s.score;

                if (max > 0 && score !== null && score !== undefined) {
                    console.log(`[GRADED] ${s.assignment.name}: ${score}/${max}`);
                    earned += score;
                    possible += max;
                    gradedCount++;
                } else if (max > 0) {
                    console.log(`[SKIPPED] ${s.assignment?.name || 'Unknown'}: No score yet.`);
                }
            });

            const percent = possible > 0 ? ((earned / possible) * 100).toFixed(2) : "0.00";
            console.log(`TOTAL FOR ${course.name}: ${earned}/${possible} (${percent}%)`);

            rows += `<tr>
                <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${percent}%</b><br><small>${gradedCount} items</small></td>
            </tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas ForensicBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `FORENSIC REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Raw Point Totals (Graded Only)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("\n✅ Forensic report sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
