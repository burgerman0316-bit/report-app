const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    const now = new Date();
    const term4Start = new Date('2026-03-12'); 
    const term3Start = new Date('2026-01-05');
    let termStartDate = (now < term4Start) ? term3Start : term4Start;

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

            // Universal 80/20 Weighted Logic
            let sEarned = 0, sMax = 0, fEarned = 0, fMax = 0;

            subRes.data.forEach(s => {
                const dueDate = new Date(s.assignment?.due_at || s.assignment?.created_at);
                const name = s.assignment?.name || "";
                
                // Only count graded items from the current term (Toggle ON logic)
                if (dueDate >= termStartDate && s.score !== null && s.assignment?.points_possible > 0) {
                    if (name.includes("Summative") || name.includes("Test") || name.includes("Project")) {
                        sEarned += s.score;
                        sMax += s.assignment.points_possible;
                    } else {
                        fEarned += s.score;
                        fMax += s.assignment.points_possible;
                    }
                }
            });

            const sScore = sMax > 0 ? (sEarned / sMax) : 0;
            const fScore = fMax > 0 ? (fEarned / fMax) : 0;

            let finalNum = 0;
            // Apply weights if both categories have grades; otherwise, scale to 100
            if (sMax > 0 && fMax > 0) {
                finalNum = (sScore * 80) + (fScore * 20);
            } else if (sMax > 0) {
                finalNum = sScore * 100;
            } else if (fMax > 0) {
                finalNum = fScore * 100;
            }

            const percent = finalNum.toFixed(2);
            let letter = finalNum >= 90 ? "A" : finalNum >= 80 ? "B" : finalNum >= 70 ? "C" : finalNum >= 60 ? "D" : "F";

            rows += `<tr>
                        <td style="padding:12px; border:1px solid #333; font-family:sans-serif;">${course.name}</td>
                        <td style="padding:12px; border:1px solid #333; text-align:center; font-family:sans-serif;">
                            <span style="font-size:18px;"><b>${percent}%</b></span><br>
                            <span style="color:#666;">${letter}</span>
                        </td>
                     </tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Grade Bot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Grade Report`,
            html: `<table border="1" style="border-collapse:collapse; width:100%; border:1px solid #333;">${rows}</table>`
        });
        console.log("✅ Universal Weighted Report Sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
