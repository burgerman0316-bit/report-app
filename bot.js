const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Lock-Picker ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the category scores directly (Summative 80% / Formative 20%)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let weightTotal = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                // 'group_score' is the API's way of showing the category total
                const score = group.group_score !== undefined ? group.group_score : null;

                if (weight > 0 && score !== null) {
                    weightedSum += (score * (weight / 100));
                    weightTotal += (weight / 100);
                }
            });

            // 2. Final Calculation - Rebuilding what the App shows
            let finalDisplay = weightTotal > 0 
                ? (weightedSum / weightTotal).toFixed(2) 
                : "N/A";

            // 3. Emergency fallback if categories are hidden too
            if (finalDisplay === "N/A" || finalDisplay === "0.00") {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                const grades = enrollRes.data[0]?.grades;
                finalDisplay = (grades?.final_score || grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalDisplay}%</b></td>
                     </tr>`;
            console.log(`Lock-Picked ${course.name}: ${finalDisplay}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Dashboard Exact Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>Bypassing API Restrictions</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Match report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
