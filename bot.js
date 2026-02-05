const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Final Core Class Sync ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the real category weights AND scores for this specific course
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let finalWeightedGrade = 0;
            let totalWeightUsed = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                let earned = 0;
                let possible = 0;

                // 2. Count EVERY assignment in that group
                group.assignments?.forEach(a => {
                    const pointsPossible = a.points_possible || 0;
                    if (pointsPossible > 0) {
                        possible += pointsPossible;
                        // Force 0 for missing assignments
                        earned += (a.submission?.score || 0);
                    }
                });

                // 3. Apply the weight only if there are assignments in that category
                if (possible > 0 && weight > 0) {
                    finalWeightedGrade += (earned / possible) * weight;
                    totalWeightUsed += weight;
                }
            });

            // 4. Final percentage (Normalizing to 100%)
            let finalPercent = totalWeightUsed > 0 
                ? (finalWeightedGrade / (totalWeightUsed / 100)).toFixed(2) 
                : "N/A";

            // Emergency Fallback: If calculation fails, pull the enrollment total directly
            if (finalPercent === "N/A" || finalPercent == "0.00") {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalPercent = (enrollRes.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalPercent}%</b></td>
                     </tr>`;
            console.log(`Matched ${course.name}: ${finalPercent}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `CORE CLASS FIXED: ${new Date().toLocaleDateString()}`,
            html: `<h3>Verified Weighted Totals</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: The core classes should now match.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
