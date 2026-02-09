const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    const now = new Date();
    // CALIBRATED DATE: 32 days from Feb 8th
    const term4Start = new Date('2026-03-12');
    const term3Start = new Date('2026-01-05');

    let termStartDate = (now < term4Start) ? term3Start : term4Start;

    console.log(`--- SYNCING FOR TERM START: ${termStartDate.toLocaleDateString()} ---`);
    
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': 'assignment', 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;

            subRes.data.forEach(s => {
                const dueDate = new Date(s.assignment?.due_at || s.assignment?.created_at);
                const max = s.assignment?.points_possible || 0;
                if (dueDate >= termStartDate && max > 0 && s.score !== null && s.score !== undefined) {
                    earned += s.score;
                    possible += max;
                }
            });

            const num = possible > 0 ? (earned / possible) * 100 : 0;
            const percent = num.toFixed(2);

            // --- GRADE LETTER LOGIC ---
            let letter = "F";
            if (num >= 90) letter = "A";
            else if (num >= 80) letter = "B";
            else if (num >= 70) letter = "C";
            else if (num >= 60) letter = "D";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">
                            <span style="font-size:18px;"><b>${percent}%</b></span><br>
                            <span style="color:#666;">(${letter})</span>
                        </td>
                     </tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas Dashboard" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `CURRENT TERM REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3 style="font-family:sans-serif;">Current Term Grades (Started ${termStartDate.toLocaleDateString()})</h3>
                   <table border="1" style="border-collapse:collapse; width:100%; font-family:sans-serif;">
                   ${rows}
                   </table>`
        });
        console.log("✅ Accurate Auto-Term Sync Sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
