const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");

    try {
        // 1. Fetch from Canvas
        console.log("Connecting to Canvas...");
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
            if (course.name && course.enrollments) {
                const score = course.enrollments[0]?.computed_current_score ?? "N/A";
                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}%</b></td>
                         </tr>`;
                console.log(`Course Found: ${course.name} (${score}%)`);
            }
        });

        // 2. Email Setup
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true, // Use SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Send Email
        console.log("Attempting to send email...");
        const info = await transporter.sendMail({
            from: `"GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Grade Report: ${new Date().toLocaleDateString()}`,
            html: `<h2>Weekly Grades</h2><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Email sent!");
        console.log("Message ID:", info.messageId);

        // Wait 5 seconds before closing to ensure the connection finishes
        console.log("Finalizing connection...");
        await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
        console.error("❌ ERROR:");
        console.error(error.message);
        process.exit(1); 
    }
}

start();
