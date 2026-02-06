const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Category-Level Extraction ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the pre-calculated group scores (the 'secret' totals)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let finalWeightedGrade = 0;
            let totalWeightPossible = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                
                // This 'group_score' is the calculated total for that bucket (e.g., 80% Summative)
                // If it's null, we force a 0 to account for missing work.
                const groupScore = group.group_score !== null ? group.group_score : 0;

                if (weight > 0) {
                    finalWeightedGrade += (groupScore * (weight / 100));
                    totalWeightPossible += (weight / 100);
                }
            });

            // 2. Normalize and fix the decimal
            let finalResult = totalWeightPossible > 0 
                ? (finalWeightedGrade / totalWeightPossible).toFixed(2) 
                : "0.00";

            // Fallback: If category math is blocked, use the enrollment summary
            if (finalResult === "0.00" || finalResult === "N/A") {
                const enroll = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalResult = (enroll.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalResult}%</b></td>
                     </tr>`;
            console.log(`Course: ${course.name} -> ${finalResult}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `CATEGORY RE-SYNC: ${new Date().toLocaleDateString()}`,
            html: `<h3>Recalculated via Category Totals</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Category-level sync sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
