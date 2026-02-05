const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Dashboard Mimic ---");
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
                
                // Dashboard specifically uses 'final_score' to account for missing work
                // We fallback to 'current_score' only if 'final' is empty
                let dashboardMatch = grades?.final_score || grades?.current_score || "N/A";

                // Rounding to match your app's display
                if (dashboardMatch !== "N/A") {
                    dashboardMatch = parseFloat(dashboardMatch).toFixed(2);
                }

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${dashboardMatch}${dashboardMatch !== "N/A" ? "%" : ""}</b></td>
                         </tr>`;
                console.log(`${course.name}: ${dashboardMatch}%`);
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
            subject: `App Match Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Matched Grades</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: App Match Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
