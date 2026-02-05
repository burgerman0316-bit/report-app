const axios = require('axios');
const nodemailer = require('nodemailer');

async function start() {
    console.log("--- Starting Grade Bot ---");
    try {
        console.log("Connecting to Canvas...");
        const res = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active', 'include[]': 'total_scores' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let rows = "";
        res.data.forEach(course => {
            if (course.name && course.enrollments) {
                const score = course.enrollments[0]?.computed_final_score ?? "N/A";
                rows += `<tr><td>${course.name}</td><td><b>${score}%</b></td></tr>`;
                console.log(`Found: ${course.name} - ${score}%`);
            }
        });

        console.log("Configuring Mailer...");
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        console.log("Attempting to send email...");
        await transporter.sendMail({
            from: `"GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com", 
            subject: `Grade Report: ${new Date().toLocaleDateString()}`,
            html: `<table border="1">${rows}</table>`
        });

        console.log("✅ SUCCESS: Email sent!");
    } catch (error) {
        console.error("❌ ERROR FOUND:");
        // This will now tell us the REAL error (like "Invalid Login")
        console.error(error.message); 
        process.exit(1); 
    }
}
start();
