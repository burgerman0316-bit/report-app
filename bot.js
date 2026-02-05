const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Manual 80/20 Calculation ---");
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name) continue;

            // 1. Get all assignments for this course to see scores and categories
            const assignRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments`, {
                params: { 'include[]': ['submission'], 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            // 2. Identify Summatives vs Formatives and calculate
            let summativeScore = 0, summativePossible = 0;
            let formativeScore = 0, formativePossible = 0;

            assignRes.data.forEach(a => {
                const points = a.submission?.score || 0; // Counts missing as 0
                const possible = a.points_possible || 0;
                
                // Checks the assignment name or group for "Summative" vs "Formative"
                if (a.name.toLowerCase().includes('summative')) {
                    summativeScore += points; summativePossible += possible;
                } else {
                    formativeScore += points; formativePossible += possible;
                }
            });

            // 3. Apply the 80/20 Math
            const sPerc = summativePossible > 0 ? (summativeScore / summativePossible) : 0;
            const fPerc = formativePossible > 0 ? (formativeScore / formativePossible) : 0;
            
            // If the class has both, use 80/20. If only one, use 100% of that one.
            let finalCalc = (summativePossible > 0 && formativePossible > 0) 
                ? (sPerc * 80) + (fPerc * 20)
                : (sPerc + fPerc) * 100;

            // Fallback for classes like PE/Art that might not use the 80/20 labels
            if (finalCalc === 0) {
                const enrollRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/enrollments`, {
                    params: { 'user_id': 'self' },
                    headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                });
                finalCalc = enrollRes.data[0]?.grades?.final_score || enrollRes.data[0]?.grades?.current_score || 0;
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
            subject: `Manual Calculation Report: ${new Date().toLocaleDateString()}`,
            html: `<h3>80/20 Forced Calculation</h3><table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ SUCCESS: Manual calculation report sent.");
    } catch (error) {
        console.error("❌ ERROR:", error.message); 
        process.exit(1); 
    }
}
start();
