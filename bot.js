const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    try {
        // Fetch courses with enrollment data included
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 
                'enrollment_state': 'active', 
                'per_page': 100,
                'include[]': 'total_scores' // This is the key to matching your phone
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // Pull the score directly from the enrollment object
            const enrollment = course.enrollments ? course.enrollments[0] : null;
            const score = enrollment ? enrollment.computed_current_score : null;
            const grade = enrollment ? enrollment.computed_current_grade : "-";

            // Format the score for display
            const displayScore = score !== null ? `${score.toFixed(2)}%` : "N/A";

            rows += `<tr>
                        <td style="padding:12px; border:1px solid #333; font-family:sans-serif;">${course.name}</td>
                        <td style="padding:12px; border:1px solid #333; text-align:center; font-family:sans-serif;">
                            <span style="font-size:18px;"><b>${displayScore}</b></span><br>
                            <span style="color:#666;">${grade || ""}</span>
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
        console.log("✅ Direct Sync Complete.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
