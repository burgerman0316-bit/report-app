const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Emergency Dashboard Extraction ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // This is the EXACT call the mobile app makes to get the dashboard percentage
            const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                params: { 'user_id': 'self' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            const grades = enrollRes.data[0]?.grades;
            
            // For Hogan/Core classes, we use 'final_score' to ensure it matches the app's 0-penalty logic
            let finalPercent = grades?.final_score || grades?.current_score || "0.00";
            
            if (typeof finalPercent === 'number') {
                finalPercent = finalPercent.toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalPercent}%</b></td>
                     </tr>`;
            console.log(`Extracted ${course.name}: ${finalPercent}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `DASHBOARD SYNC SUCCESS: ${new Date().toLocaleDateString()}`,
            html: `<h3>Direct Mobile Dashboard Extraction</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: The dashboard numbers have been extracted.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
