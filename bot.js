const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- STARTING CLASS-BY-CLASS WEIGHTED RECALCULATION ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;
            console.log(`\nProcessing: ${course.name}`);

            // 1. Fetch Assignment Groups to find weights (Summative/Formative/etc)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': 'assignments', 'override_assignment_group_id': true },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let courseWeightedTotal = 0;
            let totalWeightsFound = 0;

            for (const group of groupsRes.data) {
                const groupWeight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                // 2. Loop through every assignment in this specific group
                for (const assignment of (group.assignments || [])) {
                    const score = assignment.submission?.score;
                    const possible = assignment.points_possible;

                    // TOGGLE MATCH: Only count if it has a real score (ignores "Missing")
                    if (possible > 0 && score !== null && score !== undefined) {
                        groupEarned += score;
                        groupPossible += possible;
                    }
                }

                // 3. If the group has graded work, calculate its contribution to the final grade
                if (groupPossible > 0 && groupWeight > 0) {
                    const groupScore = (groupEarned / groupPossible);
                    courseWeightedTotal += (groupScore * groupWeight);
                    totalWeightsFound += groupWeight;
                    console.log(` - Group "${group.name}" (${groupWeight}%): ${(groupScore * 100).toFixed(2)}%`);
                }
            }

            // 4. Normalize the grade to a 100% scale
            let finalRecalc = totalWeightsFound > 0 
                ? (courseWeightedTotal / (totalWeightsFound / 100)).toFixed(2) 
                : "0.00";

            // Fallback for classes that don't use weights (points only)
            if (finalRecalc === "0.00") {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalRecalc = (enrollRes.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                <td style="padding:10px; border:1px solid #ddd; text-align:right;"><b>${finalRecalc}%</b></td>
            </tr>`;
            console.log(`Final Recalculated: ${finalRecalc}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas RecalcBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `DEEP RECALC REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Weighted Grade Mirror (Toggle ON)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("\n✅ Recalculated report sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
