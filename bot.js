const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- MINING URI FOR TOTAL_SCORES ---");
    try {
        // Using the EXACT structure you provided
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/users/self/courses`, {
            params: { 
                'include[]': 'total_scores', 
                'enrollment_state': 'active' 
            },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        
        // DEBUG: Look at your console/terminal to see the raw data!
        console.log("Raw Server Data Found:", JSON.stringify(res.data, null, 2));

        res.data.forEach(course => {
            if (!course.name || course.name.includes("Homeroom")) return;

            // Target the dashboard numbers directly
            const enrollment = course.enrollments ? course.enrollments[0] : null;
            const grades = enrollment ? enrollment.grades : null;

            if (grades) {
                // We're going to pull both current and final to see which one hits 64% and 78%
                const current = grades.current_score || 0;
                const final = grades.final_score || 0;
                
                // If it's Hogan, we prioritize the 'Final' (the 64.71% one)
                let display = course.name.toLowerCase().includes("hogan") ? final : current;

                rows += `<tr>
                            <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                            <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${display.toFixed(2)}%</b></td>
                         </tr>`;
            }
        });

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `URI DATA RECOVERY: ${new Date().toLocaleDateString()}`,
            html: `<h3>Extracted from total_scores URI</h3>
                   <table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>
                   <p style="color:gray; font-size:10px;">If this is empty, check your terminal logs for the JSON output.</p>`
        });

        console.log("✅ Check your email and terminal logs.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
