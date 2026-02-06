const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- FINAL MASTER SYNC: WEIGHTED ENGINE ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get Weighted Groups AND every assignment score
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': 'assignments', 'override_assignment_group_id': true },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let courseWeightedSum = 0;
            let courseTotalWeight = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                for (const a of (group.assignments || [])) {
                    if (a.points_possible > 0) {
                        groupPossible += a.points_possible;
                        // Grab score; if null/missing, it's a 0 (The Truth)
                        const score = a.submission?.score;
                        groupEarned += (score !== null && score !== undefined) ? score : 0;
                    }
                }

                // 2. Apply Weighting (e.g., if you have 80% in a group weighted at 40% of grade)
                if (groupPossible > 0 && weight > 0) {
                    courseWeightedSum += (groupEarned / groupPossible) * weight;
                    courseTotalWeight += weight;
                }
            }

            // 3. Final Calculation (Normalize to 100%)
            let finalGrade = courseTotalWeight > 0 
                ? (courseWeightedSum / (courseTotalWeight / 100)).toFixed(2) 
                : "0.00";

            // Fallback for non-weighted classes (like Art/PE)
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
            subject: `MASTER WEIGHT REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Manual Weighted Calculation (Mobile App Clone)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Master Sync complete.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
