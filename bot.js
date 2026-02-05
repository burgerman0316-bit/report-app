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
        let courseCount = 0;

        res.data.forEach(course => {
            if (course.name && course.enrollments) {
                const score = course.enrollments[0]?.computed_current_score ?? "N/A";
                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}%</b></td>
                         </tr>`;
                courseCount++;
                console.log(`Found: ${course.name} - ${score}%`);
            }
        });

        if (courseCount === 0) {
            console.log("No active courses with grades found.");
            return;
        }

        // 2. Email Setup (Gmail)
        console.log("Configuring Mailer...");
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // 3. Send Email
        console.log("Attempting to send email...");
        const mailOptions = {
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Weekly Grade Report - ${new Date().toLocaleDateString()}`,
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Your Weekly Grades</h2>
                    <table style="border-collapse: collapse; width: 100%; max-width: 500px;">
                        <thead>
                            <tr style="background: #f2f2f2;">
                                <th style="padding:10px; border:1px solid #ddd; text-align:left;">Course</th>
                                <th style="padding:10px; border:1px solid #ddd; text-align:center;">Grade</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                    <p style="font-size: 12px; color: #666; margin-top: 20px;">
                        Generated automatically via GitHub Actions.
                    </p>
                </div>
            `
        };

        // The Fix: Await the send so the script doesn't close early
        let info = await transporter.sendMail(mailOptions);
        
        console.log("✅ SUCCESS: Email sent to carterdiesel957@gmail.com");
        console.log("Message ID:", info.messageId);

    } catch (error) {
        console.error("❌ ERROR FOUND:");
        if (error.response) {
            console.error(`Canvas API Status: ${error.response.status}`);
        } else {
            console.error(error.message);
        }
        process.exit(1); // Forces GitHub Action to show as Red/Failed
    }
}

start();
