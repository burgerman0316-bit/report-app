const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Executing Final Weighted Recovery ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get Weighted Groups (Summative 80%, etc.)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'], 'override_assignment_group_id': true },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let weightedScore = 0;
            let totalWeight = 0;

            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let earned = 0, possible = 0;

                for (const a of (group.assignments || [])) {
                    if (a.points_possible > 0) {
                        possible += a.points_possible;
                        // The Truth: Force 0 for missing/unscored work
                        earned += (a.submission?.score || 0);
                    }
                }

                if (possible > 0 && weight > 0) {
                    weightedScore += (earned / possible) * weight;
                    totalWeight += weight;
                }
            }

            // 2. Adjust for non-weighted classes (like PE)
            let finalVal = totalWeight > 0 ? (weightedScore / (totalWeight / 100)).toFixed(2) : "0.00";
            if (finalVal === "0.00") {
                const enroll = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalVal = (enroll.data[0]?.grades?.current_score || 0).toFixed(2);
            }

            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${finalVal}%</b></td></tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas TruthBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `THE TRUTH REPORT: ${new Date().toLocaleDateString()}`,
            html: `<table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Final Sync Sent.");
    } catch (error) { console.error(error.message); }
}
start();
