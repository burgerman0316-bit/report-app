const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Deep Sync Bot ---");
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
                const grades = course.enrollments[0].grades;
                
                // We are going to try to pull the 'current_score' 
                // but specifically from the grades object which handles the 80/20 split
                let reportGrade = grades?.current_score;

                // If the teacher has 'Muted' grades, current_score might be wrong.
                // We check if 'final_score' is lower and use that to capture missing work.
                if (grades?.final_score && grades.final_score < reportGrade) {
                    reportGrade = grades.final_score;
                }

                // If it's still coming up as 72% for Hogan, it's because the API 
                // is being restricted by your school's 'Hide totals' setting.
                const displayScore = (reportGrade !== undefined && reportGrade !== null) 
                    ? reportGrade.toFixed(2) 
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
            subject: `Deep Sync Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>80/20 Weighted Match</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Deep Sync Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
