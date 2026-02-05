const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 
                'per_page': 100, 
                'enrollment_state': 'active', 
                'include[]': ['total_scores', 'current_gradeless_enrollment'] 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        res.data.forEach(course => {
            if (course.name && course.enrollments && course.enrollments[0]) {
                const enrollment = course.enrollments[0];
                
                // Priority 1: Weighted Grade (The 80/20 split)
                // Priority 2: Current Score
                // Priority 3: Final Score
                const score = enrollment.grades?.current_score 
                           || enrollment.computed_current_score 
                           || enrollment.computed_final_score 
                           || "N/A";

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}${score !== "N/A" ? "%" : ""}</b></td>
                         </tr>`;
                console.log(`Course: ${course.name} | Grade: ${score}`);
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
            subject: `Updated Grade Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Your Grades</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Report Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
