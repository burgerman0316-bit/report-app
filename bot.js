const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Final Dashboard Sync ---");
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
                
                // Dashboard Logic: Use 'final_score' to include missing work as 0
                // This is the ONLY field that will hit Hogan's 64.71%
                let realGrade = grades?.final_score || grades?.current_score || "N/A";

                if (realGrade !== "N/A") {
                    realGrade = parseFloat(realGrade).toFixed(2);
                }

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${realGrade}%</b></td>
                         </tr>`;
                console.log(`Matched ${course.name}: ${realGrade}%`);
            }
        });

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Verified Dashboard Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Exact Dashboard Match</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Grades matched to phone dashboard.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
