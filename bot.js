require('dotenv').config(); // Load environment variables
const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    try {
        console.log("🚀 Fetching grades from Canvas...");

        // We use include[]: 'total_scores' to get the grades directly in the first call
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 
                'per_page': 100, 
                'enrollment_state': 'active',
                'include[]': 'total_scores' 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of res.data) {
            // Skip courses that are blank or Homeroom
            if (!course.name || course.name.toLowerCase().includes("homeroom")) continue;

            // Extract enrollment data (where grades live)
            const enrollment = course.enrollments ? course.enrollments[0] : null;
            
            let score = "0.00";
            let letter = "N/A";

            if (enrollment && enrollment.computed_current_score !== null) {
                score = enrollment.computed_current_score.toFixed(2);
                letter = enrollment.computed_current_grade || ""; // e.g., "A-", "B+"
            }

            // Dark Mode styling for the email to match your screenshots
            rows += `
                <tr style="border-bottom: 1px solid #333;">
                    <td style="padding:15px; color: #ffffff; font-size: 14px;">
                        ${course.name}
                    </td>
                    <td style="padding:15px; text-align: right; color: #ffffff; font-size: 16px;">
                        <span style="background: #333; padding: 4px 8px; border-radius: 4px; font-weight: bold;">
                            ${score}% ${letter ? `(${letter})` : ''}
                        </span>
                    </td>
                </tr>`;
        }

        // Setup Email Transporter
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER.trim(), 
                pass: process.env.EMAIL_PASS.trim() 
            }
        });

        // HTML Email Template
        const htmlBody = `
            <div style="background-color: #000000; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <h2 style="color: #ffffff; border-bottom: 2px solid #333; padding-bottom: 10px;">Core Class Sync</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    ${rows}
                </table>
                <p style="color: #666; font-size: 12px; margin-top: 20px;">
                    Last Updated: ${new Date().toLocaleString()}
                </p>
            </div>
        `;

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `CORE CLASS SYNC: ${new Date().toLocaleDateString()}`,
            html: htmlBody
        });

        console.log("✅ Report Sent Successfully.");
    } catch (error) {
        console.error("❌ Error running script:");
        if (error.response) {
            console.error(`Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(error.message);
        }
    }
}

start();
