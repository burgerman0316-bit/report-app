const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Manual Weight Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of res.data) {
            if (!course.name) continue;

            // 1. Get the weighted groups (Summative/Formative)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let finalGrade = "N/A";
            
            // 2. Check for the weighted 'Dashboard' total specifically
            const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                params: { 'user_id': 'self' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            const grades = enrollRes.data[0]?.grades;
            
            // We use 'final_score' because it matches the Dashboard by including zeros
            if (grades?.final_score !== null && grades?.final_score !== undefined) {
                finalGrade = grades.final_score.toFixed(2) + "%";
            } else if (grades?.current_score !== null) {
                finalGrade = grades.current_score.toFixed(2) + "%";
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalGrade}`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Dashboard Match Report: ${new Date().toLocaleDateString()}`,
            html: `<div style="font-family:sans-serif;">
                    <h2>Calculated Weighted Grades</h2>
                    <table border="1" style="border-collapse:collapse; width:100%; max-width:500px;">
                        ${rows}
                    </table>
                   </div>`
        });

        console.log("✅ SUCCESS: Manual match sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
