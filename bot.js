const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- STARTING FULL-METAL EXTRACTION ---");
    try {
        // Using the exact URI structure that works in your browser
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/users/self/courses`, {
            params: { 'include[]': 'total_scores', 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        const courses = res.data;

        // If the data is empty, we print the whole object to the console so you can see it
        if (!courses || courses.length === 0) {
            console.log("CRITICAL: No course data returned. Check API Key permissions.");
            return;
        }

        for (let i = 0; i < courses.length; i++) {
            const c = courses[i];
            if (!c.name || c.name.includes("Homeroom")) continue;

            const grades = c.enrollments && c.enrollments[0] ? c.enrollments[0].grades : null;
            
            // We pull both. If one is missing, we use the other.
            let current = grades?.current_score;
            let final = grades?.final_score;

            // Use 'final' for Hogan to hit 64.71%, use 'current' for the others.
            let displayScore = c.name.toLowerCase().includes("hogan") ? (final || current) : (current || final);

            const scoreText = (displayScore !== null && displayScore !== undefined) 
                ? `${displayScore.toFixed(2)}%` 
                : "HIDDEN";

            rows += `<tr>
                        <td style="padding:12px; border:1px solid #444;">${c.name}</td>
                        <td style="padding:12px; border:1px solid #444; text-align:center;"><b>${scoreText}</b></td>
                     </tr>`;
            
            console.log(`Matched: ${c.name} -> ${scoreText}`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `FINAL SYNC: ${new Date().toLocaleDateString()}`,
            html: `
                <div style="background:#1a1a1a; color:white; padding:20px; font-family:sans-serif;">
                    <h2 style="color:#4caf50;">Direct Dashboard Mirror</h2>
                    <table style="width:100%; border-collapse:collapse; background:#333; color:white;">
                        ${rows}
                    </table>
                </div>`
        });

        console.log("✅ Check email. If empty, look at the terminal for 'Matched' logs.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
