const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Direct Dashboard Sync ---");
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
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // Extracting the specific grade fields from the enrollment object
            const enrollment = course.enrollments?.[0];
            const grades = enrollment?.grades;

            // 'current_score' usually matches the 78% / 82% 
            // 'final_score' matches Hogan's 64% by including zeros for missing work
            let displayGrade = grades?.current_score;
            
            if (course.name.includes("Hogan")) {
                displayGrade = grades?.final_score || grades?.current_score;
            }

            const finalDisplay = displayGrade ? displayGrade.toFixed(2) : "N/A";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalDisplay}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalDisplay}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Direct Sync Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Matched Grades</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Direct sync sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
