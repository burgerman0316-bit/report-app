const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");
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
                
                // FORCE 'final_score' to capture missing work/zeros
                // This matches the Dashboard app view
                const score = grades?.final_score 
                           || grades?.current_score 
                           || course.enrollments[0].computed_final_score 
                           || "N/A";

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}${score !== "N/A" ? "%" : ""}</b></td>
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
            subject: `Final Grade Match: ${new Date().toLocaleDateString()}`,
            html: `<div style="font-family:sans-serif;"><h3>Dashboard Match Report</h3><table border="1" style="border-collapse:collapse;">${rows}</table></div>`
        });

        console.log("✅ SUCCESS: App-matched report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
