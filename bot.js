const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Deep Assignment Re-Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the official weighting (like Summative 80%) for this class
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'], 'override_assignment_group_id': 'true' },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedScoreTotal = 0;
            let totalWeightUsed = 0;

            for (const group of groupsRes.data) {
                const groupWeight = group.group_weight || 0;
                let earnedInGroup = 0;
                let possibleInGroup = 0;

                // 2. Loop through every assignment in this group
                if (group.assignments) {
                    for (const a of group.assignments) {
                        const pointsPossible = a.points_possible || 0;
                        if (pointsPossible > 0) {
                            // 3. Get the score (Force 0 if missing/null to match Dashboard)
                            const submission = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments/${a.id}/submissions/self`, {
                                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                            });
                            
                            const score = submission.data.score || 0;
                            earnedInGroup += score;
                            possibleInGroup += pointsPossible;
                        }
                    }
                }

                // 4. Calculate this group's contribution (e.g., how much of the 80% did you get?)
                if (possibleInGroup > 0 && groupWeight > 0) {
                    weightedScoreTotal += (earnedInGroup / possibleInGroup) * groupWeight;
                    totalWeightUsed += groupWeight;
                }
            }

            // 5. Final calculation (Normalizing to 100%)
            let finalResult = totalWeightUsed > 0 
                ? (weightedScoreTotal / totalWeightUsed).toFixed(2) 
                : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalResult}%</b></td>
                     </tr>`;
            console.log(`Deep Calc: ${course.name} = ${finalResult}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Deep Re-Calculation: ${new Date().toLocaleDateString()}`,
            html: `<h3>Manual Assignment-Level Math</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Re-calculation complete.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
