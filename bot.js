const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Deep Math Sync ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name) continue;

            // Pulling the specific 80/20 weights directly from the course settings
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let weightDenominator = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                // Using 'raw' unweighted_score to bypass the "Current Score" lie
                const score = group.assignments?.[0]?.unweighted_score || group.assignments?.[0]?.score || 0;

                if (weight > 0) {
                    weightedSum += (score * (weight / 100));
                    weightDenominator += (weight / 100);
                }
            });

            // If manual math fails, force pull the dashboard 'final_score' (includes zeros)
            let finalGrade;
            if (weightDenominator > 0) {
                finalGrade = (weightedSum / weightDenominator).toFixed(2);
            } else {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                const grades = enrollRes.data[0]?.grades;
                finalGrade = grades?.final_score || grades?.current_score || "N/A";
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}${finalGrade !== "N/A" ? "%" : ""}</b></td>
                     </tr>`;
            console.log(`Synced ${course.name}: ${finalGrade}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Deep Math Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Matched Report</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Deep Math report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
