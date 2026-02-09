const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    // --- AUTOMATIC TERM DETECTION ---
    const now = new Date();
    let termStartDate;

    // Adjust these months/days to match your school's actual calendar
    if (now < new Date('2026-03-23')) {
        // We are in Term 3
        termStartDate = new Date('2026-01-05'); 
    } else {
        // It is now March 23rd or later -> Term 4 has started
        termStartDate = new Date('2026-03-23'); 
    }

    console.log(`--- SYNCING FOR TERM START: ${termStartDate.toLocaleDateString()} ---`);
    
    try {
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'enrollment_state': 'active', 'per_page': 100 },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        for (const course of res.data) {
            if (!course.name || course.name.includes("Homeroom")) continue;

            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/students/submissions`, {
                params: { 'include[]': 'assignment', 'per_page': 100 },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let earned = 0;
            let possible = 0;

            subRes.data.forEach(s => {
                const dueDate = new Date(s.assignment?.due_at || s.assignment?.created_at);
                const max = s.assignment?.points_possible || 0;
                
                // Only count items from the CURRENT Term
                if (dueDate >= termStartDate && max > 0 && s.score !== null && s.score !== undefined) {
                    earned += s.score;
                    possible += max;
                }
            });

            const percent = possible > 0 ? ((earned / possible) * 100).toFixed(2) : "0.00";

            rows += `<tr>
                        <td style="padding:10px; border:1px solid #ddd;">${course.name}</td>
                        <td style="padding:10px; border:1px solid #ddd; text-align:center;"><b>${percent}%</b></td>
                     </tr>`;
        }

        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER.trim(), pass: process.env.EMAIL_PASS.trim() }
        });

        await transporter.sendMail({
            from: `"Canvas AutoTerm" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `AUTO-TERM REPORT: ${new Date().toLocaleDateString()}`,
            html: `<h3>Current Term Grades (Started ${termStartDate.toLocaleDateString()})</h3>
                   <table border="1" style="border-collapse:collapse; width:100%;">${rows}</table>`
        });
        console.log("✅ Auto-Term Sync Sent.");
    } catch (error) { console.error("❌ ERROR:", error.message); }
}
start();
