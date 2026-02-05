const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Absolute Zero Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            // 1. Get ALL assignments and their raw submission data
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let sumScore = 0, sumMax = 0;
            let formScore = 0, formMax = 0;

            assignRes.data.forEach(a => {
                const max = a.points_possible || 0;
                if (max <= 0) return;

                // FORCE MISSING TO ZERO: This is why Hogan is 64% on your phone
                const score = a.submission?.score || 0;

                // Identify Category (Summative vs Formative)
                // If the name doesn't say "Summative", we treat it as Formative
                const isSummative = a.name.toLowerCase().includes('summative') || 
                                    a.name.toLowerCase().includes('test') ||
                                    a.name.toLowerCase().includes('unit');

                if (isSummative) {
                    sumScore += score; sumMax += max;
                } else {
                    formScore += score; formMax += max;
                }
            });

            // 2. Apply 80/20 Weighted Math Manually
            let finalCalc = 0;
            const sPerc = sumMax > 0 ? (sumScore / sumMax) : null;
            const fPerc = formMax > 0 ? (formScore / formMax) : null;

            if (sPerc !== null && fPerc !== null) {
                finalCalc = (sPerc * 80) + (fPerc * 20);
            } else if (sPerc !== null) {
                finalCalc = sPerc * 100;
            } else if (fPerc !== null) {
                finalCalc = fPerc * 100;
            } else {
                finalCalc = 0;
            }

            const display = finalCalc.toFixed(2);
            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${display}%</b></td>
                     </tr>`;
            console.log(`Calculated ${course.name}: ${display}%`);
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Absolute Zero Match: ${new Date().toLocaleDateString()}`,
            html: `<h3>No-API Summary Calculation</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Absolute Zero Match Sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
