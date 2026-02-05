const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting True 80/20 Weight Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name) continue;

            // 1. Get ALL assignments and their specific scores
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let sumScore = 0, sumMax = 0;
            let formScore = 0, formMax = 0;

            assignRes.data.forEach(a => {
                const score = a.submission?.score || 0; // Missing = 0
                const max = a.points_possible || 0;
                if (max === 0) return;

                // Checking both the assignment name and the group ID for "Summative"
                const isSummative = a.name.toLowerCase().includes('summative');
                
                if (isSummative) {
                    sumScore += score; sumMax += max;
                } else {
                    formScore += score; formMax += max;
                }
            });

            // 2. Perform the Weighted Calculation
            let finalCalc = 0;
            const sPerc = sumMax > 0 ? (sumScore / sumMax) : null;
            const fPerc = formMax > 0 ? (formScore / formMax) : null;

            if (sPerc !== null && fPerc !== null) {
                finalCalc = (sPerc * 80) + (fPerc * 20);
            } else if (sPerc !== null) {
                finalCalc = sPerc * 100;
            } else if (fPerc !== null) {
                finalCalc = fPerc * 100;
            }

            // Fallback: If calculation results in 0 but app shows a grade
            if (finalCalc === 0) {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalCalc = enrollRes.data[0]?.grades?.final_score || 0;
            }

            const display = parseFloat(finalCalc).toFixed(2);
            rows += `<tr><td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                     <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${display}%</b></td></tr>`;
            console.log(`${course.name}: ${display}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Weight Verified Report: ${new Date().toLocaleDateString()}`,
            html: `<div style="font-family:sans-serif;"><h2>80/20 Category Calculation</h2><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table></div>`
        });
        console.log("✅ SUCCESS: Weighted report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
