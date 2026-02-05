const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Hybrid Sync ---");
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
                const grades = enrollment.grades;
                
                // Priority: Use final_score to capture zeros (fixes Math/Science)
                // Fallback: Use computed_final_score (fixes Hogan)
                let score = grades?.final_score 
                           || enrollment.computed_final_score 
                           || grades?.current_score 
                           || "N/A";

                // Formatting to match your app
                if (score !== "N/A") {
                    score = parseFloat(score).toFixed(2);
                }

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}%</b></td>
                         </tr>`;
                console.log(`${course.name}: ${score}%`);
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
            subject: `Real App Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Match Report</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Hybrid report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
