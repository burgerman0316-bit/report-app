const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Final Decimal Correction ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedScoreTotal = 0;
            let totalWeightUsed = 0;

            for (const group of groupsRes.data) {
                const groupWeight = group.group_weight || 0;
                let earnedInGroup = 0;
                let possibleInGroup = 0;

                group.assignments?.forEach(a => {
                    const possible = a.points_possible || 0;
                    if (possible > 0) {
                        possibleInGroup += possible;
                        // Force 0 for missing to hit Hogan's 64.71%
                        earnedInGroup += (a.submission?.score || 0);
                    }
                });

                if (possibleInGroup > 0 && groupWeight > 0) {
                    // Multiply by 100 here to fix the 0.61% -> 61% error
                    const groupGrade = (earnedInGroup / possibleInGroup) * 100;
                    weightedScoreTotal += (groupGrade * (groupWeight / 100));
                    totalWeightUsed += (groupWeight / 100);
                }
            }

            // Normalizing result
            let finalResult = totalWeightUsed > 0 
                ? (weightedScoreTotal / totalWeightUsed).toFixed(2) 
                : "0.00";

            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalResult}%</b></td></tr>`;
            console.log(`${course.name}: ${finalResult}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `FINAL Match Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>Assignment-Level Percentages Fixed</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Decimal fix sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
