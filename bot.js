const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Executing Deep Data-Mine (Attempt 14) ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get Weighting Groups
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let weightUsed = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                
                // 2. Fetch EVERY assignment with SUBMISSION HISTORY (The Deep Layer)
                const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                    params: { 
                        'assignment_group_id': group.id,
                        'include[]': ['submission'], // This is what shows the REAL score
                        'per_page': 100 
                    },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });

                let groupEarned = 0;
                let groupPossible = 0;

                assignRes.data.forEach(a => {
                    const p = a.points_possible || 0;
                    if (p > 0) {
                        groupPossible += p;
                        // Force 0 for anything that isn't a confirmed score
                        const s = a.submission?.score;
                        groupEarned += (s !== null && s !== undefined) ? s : 0;
                    }
                });

                if (groupPossible > 0 && weight > 0) {
                    weightedSum += (groupEarned / groupPossible) * weight;
                    weightUsed += weight;
                }
            }

            // 3. Normalizing the math
            let finalGrade = weightUsed > 0 ? (weightedSum / (weightUsed / 100)).toFixed(2) : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}%</b></td>
                     </tr>`;
            console.log(`Mined ${course.name}: ${finalGrade}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `DEEP MINE REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Bypassing Summary Blocks</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Data-mine complete.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
    }
}
start();
