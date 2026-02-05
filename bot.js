const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get the pre-calculated category scores from Canvas
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedSum = 0;
            let weightTotal = 0;

            groupsRes.data.forEach(group => {
                const weight = group.group_weight || 0;
                // 'group_score' is the ONLY field that matches the phone app
                const score = group.group_score;

                if (weight > 0 && score !== null && score !== undefined) {
                    weightedSum += (score * (weight / 100));
                    weightTotal += (weight / 100);
                }
            });

            // 2. Normalize to 100%
            let finalGrade = weightTotal > 0 ? (weightedSum / weightTotal).toFixed(2) : "N/A";

            // 3. Fallback for classes like PE that don't use weights
            if (finalGrade === "N/A" || finalGrade === "0.00") {
                const enroll = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalGrade = (enroll.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalGrade}%</b></td></tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `CORE CLASS SYNC: ${new Date().toLocaleDateString()}`,
            html: `<table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Report Sent.");
    } catch (error) { console.error(error); }
}
start();
