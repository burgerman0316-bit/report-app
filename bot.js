const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Manual Math Bot ---");
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
                
                // Use final_score if available (includes zeros), otherwise use computed_final_score
                let finalScore = enrollment.grades?.final_score || enrollment.computed_final_score;

                // If it's still pulling that 72% for Hogan, we force it to look at the 'current_score'
                // and pick the lower of the two. The lower one is almost always the one with zeros included.
                if (enrollment.grades?.current_score && enrollment.grades.current_score < finalScore) {
                    finalScore = enrollment.grades.current_score;
                }

                const displayScore = (finalScore !== undefined && finalScore !== null) 
                    ? finalScore 
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
            subject: `Dashboard Match Test: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Match Attempt</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Manual Math Report Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
