const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Ultimate Grade Sync ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the real category weights and current scores for those categories
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let weightDenominator = 0;

            groupsRes.data.forEach(group => {
                // 'group_weight' is the % (80, 20, etc.)
                // 'group_score' is the actual grade for that bucket (includes zeros)
                const weight = group.group_weight || 0;
                const score = (group.group_score !== undefined && group.group_score !== null) ? group.group_score : null;

                if (weight > 0 && score !== null) {
                    weightedSum += (score * (weight / 100));
                    weightDenominator += (weight / 100);
                }
            });

            // 2. Final Result
            let finalCalc = weightDenominator > 0 
                ? (weightedSum / weightDenominator).toFixed(2) 
                : null;

            // 3. Last Ditch: If weights are missing, pull the direct final_score
            if (finalCalc === null || finalCalc == "0.00") {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                const grades = enrollRes.data[0]?.grades;
                finalCalc = (grades?.final_score || grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalCalc}%</b></td>
                     </tr>`;
            console.log(`Syncing ${course.name}: ${finalCalc}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Ultimate Grade Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Match (Attempt #12)</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Ultimate report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
