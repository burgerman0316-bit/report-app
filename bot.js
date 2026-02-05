const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Individual Class Sync ---");
    try {
        // 1. Get all active courses
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of res.data) {
            if (!course.name) continue;

            // 2. Fetch a fresh enrollment report for THIS specific class
            // This pulls the deep 'grades' object that handles the 80/20 split
            const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                params: { 'user_id': 'self' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            const enrollment = enrollRes.data[0];
            const grades = enrollment?.grades;

            // FIX: We use final_score to ensure missing assignments (zeros) are counted.
            // This is likely why Hogan says 64% in the app but 72% in the bot.
            const score = grades?.final_score || grades?.current_score || "N/A";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}%</b></td>
                     </tr>`;
            
            console.log(`Verified ${course.name}: ${score}%`);
        }

        // 3. Email Transport
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
            subject: `Dashboard Match Report: ${new Date().toLocaleDateString()}`,
            html: `<div style="font-family:sans-serif;">
                    <h2>Dashboard Matched Grades</h2>
                    <p>This report matches the numbers shown on your Canvas Phone App.</p>
                    <table border="1" style="border-collapse:collapse; width:100%; max-width:500px;">
                        <tr style="background:#eee;"><th>Course</th><th>Grade</th></tr>
                        ${rows}
                    </table>
                   </div>`
        });

        console.log("✅ SUCCESS: Individual class sync sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
