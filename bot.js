const axios = require('axios');
const nodemailer = require('nodemailer');

// These will be stored securely in GitHub Secrets
const CANVAS_API_KEY = process.env.CANVAS_API_KEY;
const CANVAS_URL = process.env.CANVAS_URL; // e.g., https://canvas.instructure.com
const TARGET_EMAIL = process.env.TARGET_EMAIL;

async function sendGradeReport() {
    try {
        // 1. Fetch Courses and Grades
        const response = await axios.get(`${CANVAS_URL}/api/v1/courses`, {
            params: { 'include[]': 'total_scores', 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${CANVAS_API_KEY}` }
        });

        let rowsHtml = "";
        response.data.forEach(course => {
            if (course.name) {
                const score = course.enrollments?.[0]?.computed_current_score || "N/A";
                rowsHtml += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #eee;">${course.name}</td>
                        <td style="padding:10px; border-bottom:1px solid #eee; font-weight:bold;">${score}%</td>
                    </tr>`;
            }
        });

        // 2. Email Formatting
        const emailBody = `
            <div style="font-family: sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px;">
                <h2 style="color: #E74C3C;">Friday Grade Update</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background: #f8f8f8;">
                        <th style="text-align:left; padding:10px;">Course</th>
                        <th style="text-align:left; padding:10px;">Grade</th>
                    </tr>
                    ${rowsHtml}
                </table>
            </div>`;

        // 3. Send via SMTP (Example using Gmail)
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS // Use an "App Password" here
            }
        });

        await transporter.sendMail({
            from: '"GradeBot" <your-email@gmail.com>',
            to: TARGET_EMAIL,
            subject: "Your Weekly Grade Report",
            html: emailBody
        });

        console.log("Report sent successfully!");
    } catch (error) {
        console.error("Error running GradeBot:", error);
    }
}

sendGradeReport();
