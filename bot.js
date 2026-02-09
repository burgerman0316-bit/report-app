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

            let sEarned = 0, sMax = 0, fEarned = 0, fMax = 0;
            let totalEarned = 0, totalMax = 0;

            subRes.data.forEach(s => {
                const dueDate = new Date(s.assignment?.due_at || s.assignment?.created_at);
                const score = s.score;
                const max = s.assignment?.points_possible || 0;
                const name = (s.assignment?.name || "").toLowerCase();

                if (dueDate >= termStartDate && max > 0 && score !== null && score !== undefined) {
                    totalEarned += score;
                    totalMax += max;

                    // Separate ELA items into Summative (80%) and Formative (20%)
                    if (name.includes("sum") || name.includes("test") || name.includes("quiz") || name.includes("assess")) {
                        sEarned += score;
                        sMax += max;
                    } else {
                        fEarned += score;
                        fMax += max;
                    }
                }
            });

            let finalNum = 0;
            // Apply 80/20 weights specifically to ELA to match the 74% dashboard
            if (course.name.toLowerCase().includes("ela") && (sMax > 0 || fMax > 0)) {
                const sScore = sMax > 0 ? (sEarned / sMax) : (fEarned / fMax);
                const fScore = fMax > 0 ? (fEarned / fMax) : (sEarned / sMax);
                finalNum = (sScore * 80) + (fScore * 20);
            } else {
                // Use raw math for Math and Hogan to prevent NaN and keep accuracy
                finalNum = totalMax > 0 ? (totalEarned / totalMax) * 100 : 0;
            }

            const percent = finalNum.toFixed(2);
            let letter = finalNum >= 90 ? "A" : finalNum >= 80 ? "B" : finalNum >= 70 ? "C" : finalNum >= 60 ? "D" : "F";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;">
                            <span style="font-size:18px;"><b>${totalMax > 0 ? percent + '%' : 'N/A'}</b></span><br>
                            <span style="color:#666;">(${totalMax > 0 ? letter : '-'})</span>
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
            html: `<table border="1" style="border-collapse:collapse; width:100%; font-family:sans-serif;">${rows}</table>`
        });
        console.log("✅ ELA Weighted & Math NaN Fixed.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
