const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- FINAL SYNC: WEIGHTED + GRADED ONLY ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': 'assignments' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let courseWeightedSum = 0;
            let courseTotalWeight = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                for (const a of (group.assignments || [])) {
                    // MATCH YOUR PHONE: Only count if it has been GRADED
                    if (a.points_possible > 0 && a.submission?.score !== null && a.submission?.score !== undefined) {
                        groupEarned += a.submission.score;
                        groupPossible += a.points_possible;
                    }
                }

                if (groupPossible > 0 && weight > 0) {
                    courseWeightedSum += (groupEarned / groupPossible) * weight;
                    courseTotalWeight += weight;
                }
            }

            // Fallback for non-weighted classes
            let finalGrade = courseTotalWeight > 0 
                ? (courseWeightedSum / (courseTotalWeight / 100)).toFixed(2) 
                : "0.00";

            if (finalGrade === "0.00") {
                const enroll = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalGrade = (enroll.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:right;"><b>${finalGrade}%</b></td>
                     </tr>`;
            console.log(`Synced ${course.name}: ${finalGrade}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas MasterBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `MASTER SYNC: ${new Date().toLocaleDateString()}`,
            html: `<h3>Weighted Dashboard Mirror (Toggle ON)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Master Sync complete.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
