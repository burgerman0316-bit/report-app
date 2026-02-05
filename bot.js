const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 
                'per_page': 100, 
                'enrollment_state': 'active', 
                'include[]': 'total_scores' 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        res.data.forEach(course => {
            if (course.name && course.enrollments && course.enrollments.length > 0) {
                // This 'grades' object contains the weighted calculation (80/20 split)
                const weightedGrade = course.enrollments[0]?.grades?.current_score;
                
                // If there's no score yet (like Homeroom), it shows N/A
                const displayScore = weightedGrade !== undefined && weightedGrade !== null 
                    ? weightedGrade + "%" 
                    : "N/A";

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${displayScore}</b></td>
                         </tr>`;
                console.log(`Course: ${course.name} | Weighted Grade: ${displayScore}`);
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
            subject: `Accurate Grade Report: ${new Date().toLocaleDateString()}`,
            html: `
                <div style="font-family: sans-serif;">
                    <h2>Weighted Grade Report (80/20 Split)</h2>
                    <table border="1" style="border-collapse: collapse; width: 100%; max-width: 400px;">
                        <tr style="background: #eee;">
                            <th style="padding:10px;">Course</th>
                            <th style="padding:10px;">Grade</th>
                        </tr>
                        ${rows}
                    </table>
                </div>`
        });

        console.log("✅ SUCCESS: Weighted grades sent!");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
