const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Nuclear Math Bot ---");
    try {
        // 1. Get Courses
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of res.data) {
            if (!course.name) continue;

            // 2. For each course, get the Weighted Assignment Groups
            // This is how we find the 80/20 split directly
            const groupRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let totalWeightedScore = 0;
            let totalWeightPossible = 0;

            groupRes.data.forEach(group => {
                // Only look at groups that have a weight and a score
                if (group.group_weight > 0 && group.rules === undefined) { 
                    // Canvas stores the group's current score here
                    const groupScore = group.group_weight * (group.assignments?.[0]?.score || 0); 
                    // This is complex, so we'll try a simpler 'Dashboard' fallback first:
                }
            });

            // FALLBACK: If manual math is too messy, we use the 'unmuted' dashboard score
            // We are targeting the 'final_score' which includes zeros for missing work.
            const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                params: { 'user_id': 'self' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            const grades = enrollRes.data[0]?.grades;
            // The 'final_score' is the one that usually shows 64.71% when you have missing work
            const score = grades?.final_score || grades?.current_score || "N/A";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${score}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${score}%`);
        }

        // 3. Send Email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Dashboard Sync: ${new Date().toLocaleDateString()}`,
            html: `<h3>Manual Sync Report</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Nuclear Sync Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
