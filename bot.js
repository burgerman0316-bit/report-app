const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Forensic Grade Mining ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get Weighted Groups (Summative/Formative)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'], 'override_assignment_group_id': true },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedScore = 0;
            let totalWeight = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                for (const a of (group.assignments || [])) {
                    if (a.points_possible > 0) {
                        groupPossible += a.points_possible;
                        
                        // 2. Look deep into the submission score
                        // We use the score field directly from the assignment's submission object
                        const score = a.submission?.score;
                        groupEarned += (score !== null && score !== undefined) ? score : 0;
                    }
                }

                if (groupPossible > 0 && weight > 0) {
                    weightedScore += (groupEarned / groupPossible) * weight;
                    totalWeight += weight;
                }
            }

            // 3. Final Normalization
            let finalVal = totalWeight > 0 
                ? (weightedScore / (totalWeight / 100)).toFixed(2) 
                : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td>
                     </tr>`;
            console.log(`${course.name}: ${finalVal}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `FORENSIC REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Bypassing API "Hidden" Blocks</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Forensic report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message);
    }
}
start();
