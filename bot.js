const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Extracting Direct Enrollment Totals ---");
    try {
        // This targets the URI structure you provided
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/users/self/courses`, {
            params: { 
                'include[]': 'total_scores', 
                'enrollment_state': 'active' 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        
        res.data.forEach(course => {
            if (!course.name || course.name.includes("Homeroom")) return;

            // Grades are stored in the first enrollment object
            const grades = course.enrollments && course.enrollments[0] ? course.enrollments[0].grades : null;

            if (grades) {
                // Logic to match your specific dashboard:
                // Hogan usually matches final_score (zeros included)
                // Math/Science usually matches current_score
                let gradeToDisplay;
                if (course.name.toLowerCase().includes("hogan")) {
                    gradeToDisplay = grades.final_score || grades.current_score;
                } else {
                    gradeToDisplay = grades.current_score;
                }

                const finalResult = (gradeToDisplay !== null && gradeToDisplay !== undefined) 
                    ? gradeToDisplay.toFixed(2) 
                    : "0.00";

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalResult}%</b></td>
                         </tr>`;
                console.log(`${course.name}: ${finalResult}%`);
            }
        });

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Enrollment Sync Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Direct Dashboard Extraction</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Grades extracted and emailed.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
