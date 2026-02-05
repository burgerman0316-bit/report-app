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
                
                // This is the specific secret to finding the "Dashboard" grade:
                // We check the computed_current_score first, then fall back to the grades object.
                let finalGrade = enrollment.computed_current_score;
                
                if (enrollment.grades) {
                    // Sometimes the app uses 'current_score' and sometimes 'final_score'
                    // We want the lower one, as that usually includes the missing summatives.
                    finalGrade = Math.min(
                        enrollment.grades.current_score || 100, 
                        enrollment.grades.final_score || 100
                    );
                }

                // If Math.min failed or returned 100, use the computed score
                if (finalGrade === 100 || !finalGrade) {
                    finalGrade = enrollment.computed_current_score || "N/A";
                }

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}${finalGrade !== "N/A" ? "%" : ""}</b></td>
                         </tr>`;
                console.log(`${course.name}: ${finalGrade}%`);
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
            subject: `App-Synced Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Match</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: App-matched report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
