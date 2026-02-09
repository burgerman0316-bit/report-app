const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    const now = new Date();
    // Reset dates: Feb 8 + 32 days = March 12
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

            let sEarn = 0, sMax = 0, fEarn = 0, fMax = 0;
            let totalEarned = 0, totalMax = 0;

            subRes.data.forEach(s => {
                const dueDate = new Date(s.assignment?.due_at || s.assignment?.created_at);
                const name = (s.assignment?.name || "").toLowerCase();
                const score = s.score;
                const points = s.assignment?.points_possible;

                // Toggle logic: Only count graded items from the current term
                if (dueDate >= termStartDate && score !== null && points > 0) {
                    totalEarned += score;
                    totalMax += points;

                    // Keyword check for Weights (Summative/Formative)
                    if (name.includes("sum") || name.includes("test") || name.includes("quiz") || name.includes("exam") || name.includes("project")) {
                        sEarn += score;
                        sMax += points;
                    } else {
                        fEarn += score;
                        fMax += points;
                    }
                }
            });

            let finalNum = 0;
            let rawPercent = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
            
            // Apply 80/20 weights ONLY to ELA to fix the 66% vs 74% issue
            if (course.name.toLowerCase().includes("ela") && sMax > 0 && fMax > 0) {
                finalNum = ((sEarn / sMax) * 80) + ((fEarn / fMax) * 20);
            } else {
                // Use raw points for Math, Science, and Hogan to keep them accurate
                finalNum = rawPercent;
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
        console.log(`✅ Sync Complete for ${termStartDate.toLocaleDateString()}`);
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
