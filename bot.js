const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Brute Force Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get every single assignment and submission for this specific course
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let sumScore = 0, sumMax = 0;
            let formScore = 0, formMax = 0;

            assignRes.data.forEach(a => {
                const max = a.points_possible || 0;
                if (max === 0) return;

                // Treat empty/unsubmitted as 0 to match the App's 'Final Grade'
                const score = a.submission?.score || 0;

                // We'll check the 'assignment_group_id' or name for the 80/20 split
                const isSummative = a.name.toLowerCase().includes('summative') || 
                                    (a.assignment_group_id && a.name.toLowerCase().includes('test'));

                if (isSummative) {
                    sumScore += score; sumMax += max;
                } else {
                    formScore += score; formMax += max;
                }
            });

            // 2. Force the 80/20 Math ourselves
            const sPerc = sumMax > 0 ? (sumScore / sumMax) : null;
            const fPerc = formMax > 0 ? (formScore / formMax) : null;

            let finalPercent = 0;
            if (sPerc !== null && fPerc !== null) {
                finalPercent = (sPerc * 80) + (fPerc * 20);
            } else {
                // If the class doesn't use 80/20, use raw points (zeros included)
                finalPercent = ((sumScore + formScore) / (sumMax + formMax)) * 100;
            }

            const display = finalPercent.toFixed(2);
            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${display}%</b></td>
                     </tr>`;
            console.log(`Brute Force ${course.name}: ${display}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Brute Force Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>No-Summary Weighted Report</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });

        console.log("✅ SUCCESS: Brute Force Match Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
