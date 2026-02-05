const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Dashboard-Exact Bot ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 
                'per_page': 100, 
                'enrollment_state': 'active', 
                'include[]': ['total_scores'] 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        res.data.forEach(course => {
            if (course.name && course.enrollments && course.enrollments[0]) {
                const enrollment = course.enrollments[0];
                
                // This 'computed_final_score' is the key. 
                // It treats missing work as 0%, matching your 'Real' grade.
                const rawScore = enrollment.computed_final_score;
                
                const displayScore = (rawScore !== undefined && rawScore !== null) 
                    ? rawScore 
                    : "N/A";

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${displayScore}${displayScore !== "N/A" ? "%" : ""}</b></td>
                         </tr>`;
                console.log(`${course.name}: ${displayScore}%`);
            }
        });

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER.trim(), 
                pass: process.env.EMAIL_PASS.trim() 
            }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Dashboard Exact Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Matched Grades</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Dashboard Exact Report Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
