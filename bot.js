const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");
    try {
        // Fetch from Canvas
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active', 'include[]': 'total_scores' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        res.data.forEach(course => {
            if (course.name && course.enrollments) {
                // FIXED: 'computed_final_score' includes zeros for missing work
                const score = course.enrollments[0]?.computed_final_score ?? "N/A";
                rows += `<tr><td>${course.name}</td><td><b>${score}%</b></td></tr>`;
                console.log(`${course.name}: ${score}%`);
            }
        });

        // Email Transport
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { 
                user: process.env.EMAIL_USER.trim(), 
                pass: process.env.EMAIL_PASS.trim() 
            }
        });

        // Send
        console.log("Sending to carterdiesel957@gmail.com...");
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: "carterdiesel957@gmail.com", 
            subject: `Real Grade Report: ${new Date().toLocaleDateString()}`,
            html: `<table border="1">${rows}</table>`
        });

        console.log("✅ SUCCESS!");
    } catch (error) {
        console.error("❌ FAILED:", error.message); 
        process.exit(1); 
    }
}
start();
