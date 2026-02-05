const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Perfect Weight Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name) continue;

            // 1. Get the official weighting groups (The 80/20 buckets)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let totalWeightUsed = 0;

            // 2. Calculate based on the school's official weighted categories
            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                // 'group_score' is the grade for that specific category (Summative or Formative)
                const score = group.group_score !== undefined ? group.group_score : null;

                if (weight > 0 && score !== null) {
                    weightedSum += (score * (weight / 100));
                    totalWeightUsed += (weight / 100);
                }
            });

            // 3. Final Calculation
            let finalCalc = totalWeightUsed > 0 
                ? (weightedSum / totalWeightUsed).toFixed(2) 
                : null;

            // Fallback: If no weights are found, pull the 'final_score' (includes zeros)
            if (finalCalc === null || finalCalc == 0) {
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
            console.log(`${course.name}: ${finalCalc}%`);
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
            subject: `Verified Grade Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>Dashboard Exact Match Report</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Final calculation sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
