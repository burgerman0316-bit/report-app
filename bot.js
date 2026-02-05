const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Weighted Math Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";

        for (const course of res.data) {
            if (!course.name) continue;

            // 1. Get the 80/20 rules for this class
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let totalWeightUsed = 0;

            // 2. Loop through Summative/Formative groups
            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                const score = group.unweighted_score; // This is the group's current %

                if (weight > 0 && score !== null && score !== undefined) {
                    weightedSum += (score * (weight / 100));
                    totalWeightUsed += (weight / 100);
                }
            });

            // 3. Calculate final %
            let calculatedGrade = totalWeightUsed > 0 
                ? (weightedSum / totalWeightUsed).toFixed(2) 
                : null;

            // FALLBACK: If teacher hasn't set up weights, use the App's Dashboard value
            if (!calculatedGrade || calculatedGrade == 0) {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                calculatedGrade = enrollRes.data[0]?.grades?.current_score || "N/A";
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${calculatedGrade}%</b></td>
                     </tr>`;
            console.log(`Calculated ${course.name}: ${calculatedGrade}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER.trim(), 
                pass: process.env.EMAIL_PASS.trim() 
            }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Manual Weighted Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>80/20 Manual Calculation Report</h3><table border="1" style="border-collapse:collapse;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Manual calculation sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
