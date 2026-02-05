const axios = require('axios');
const nodemailer = require('nodemailer');

/**
 * THE HEAVY-DUTY CANVAS RE-CALCULATOR
 * Designed to bypass API blocks and match the Mobile Dashboard.
 */

async function start() {
    console.log("--- INITIALIZING DEEP SYSTEM SCAN ---");
    console.log("Targeting: Hogan (64.71%), Math (78.05%), Science (82.16%)");

    try {
        // 1. Fetch Active Courses
        const coursesRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses`, {
            params: { 'per_page': 100, 'enrollment_state': 'active' },
            headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
        });

        let emailHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f;">Deep System Re-Calculation Report</h2>
                <p>Generated: ${new Date().toLocaleString()}</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f4f4f4;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Course Name</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: center;">Re-Calculated Grade</th>
                        </tr>
                    </thead>
                    <tbody>`;

        for (const course of coursesRes.data) {
            if (!course.name || course.name.includes("Homeroom") || course.name.includes("Pattermann")) continue;

            console.log(`\n[SCANNIG] Course: ${course.name}`);
            
            // 2. Fetch Assignment Groups (Weighting Buckets)
            const groupsRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignment_groups`, {
                params: { 'include[]': ['assignments'], 'exclude_response_fields[]': ['description'] },
                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
            });

            let courseTotalWeightedScore = 0;
            let courseTotalWeightAvailable = 0;
            let rawPointsEarned = 0;
            let rawPointsPossible = 0;

            // 3. Process Each Weighting Group (Summative, Formative, etc.)
            for (const group of groupsRes.data) {
                const weight = group.group_weight || 0;
                let groupEarned = 0;
                let groupPossible = 0;

                console.log(`  -> Group: ${group.name} (Weight: ${weight}%)`);

                // 4. Manual Assignment Tallying
                if (group.assignments && group.assignments.length > 0) {
                    for (const assignment of group.assignments) {
                        const possible = assignment.points_possible || 0;
                        if (possible === 0) continue;

                        // Fetch specific submission to catch "Missing" or "Late"
                        try {
                            const subRes = await axios.get(`${process.env.CANVAS_URL}/api/v1/courses/${course.id}/assignments/${assignment.id}/submissions/self`, {
                                headers: { 'Authorization': `Bearer ${process.env.CANVAS_API_KEY}` }
                            });

                            const score = subRes.data.score || 0;
                            groupEarned += score;
                            groupPossible += possible;
                            
                            // Log specific assignments for Hogan to find that 64.71%
                            if (course.name.includes("Hogan")) {
                                console.log(`     - [ASSIGNMENT] ${assignment.name}: ${score}/${possible}`);
                            }
                        } catch (err) {
                            console.log(`     - [ERROR] Failed to fetch submission for ${assignment.name}`);
                            groupPossible += possible; // Still count possible pts for "Missing"
                        }
                    }
                }

                // 5. Apply Weighted Math for this Group
                if (groupPossible > 0) {
                    const groupPercentage = (groupEarned / groupPossible);
                    courseTotalWeightedScore += (groupPercentage * weight);
                    courseTotalWeightAvailable += weight;
                    
                    rawPointsEarned += groupEarned;
                    rawPointsPossible += groupPossible;
                }
            }

            // 6. Final Logic Check
            let finalDisplayGrade = 0;
            if (courseTotalWeightAvailable > 0) {
                // Percentage based on weights (Math/Science logic)
                finalDisplayGrade = (courseTotalWeightedScore / courseTotalWeightAvailable) * 100;
            } else if (rawPointsPossible > 0) {
                // Raw points fallback
                finalDisplayGrade = (rawPointsEarned / rawPointsPossible) * 100;
            }

            const formattedGrade = finalDisplayGrade.toFixed(2);
            console.log(`[RESULT] ${course.name}: ${formattedGrade}%`);

            emailHtml += `
                <tr>
                    <td style="padding: 10px; border: 1px solid #ddd;">${course.name}</td>
                    <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #1a73e8;">
                        ${formattedGrade}%
                    </td>
                </tr>`;
        }

        emailHtml += `</tbody></table></div>`;

        // 7. Send the Email
        let transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER.trim(),
                pass: process.env.EMAIL_PASS.trim()
            }
        });

        await transporter.sendMail({
            from: `"Canvas GradeBot" <${process.env.EMAIL_USER}>`,
            to: "carterdiesel957@gmail.com",
            subject: `HEAVY-DUTY SYSTEM SCAN: ${new Date().toLocaleDateString()}`,
            html: emailHtml
        });

        console.log("\n✅ SUCCESS: Full system scan completed and email sent.");

    } catch (error) {
        console.error("\n❌ CRITICAL SYSTEM ERROR:");
        console.error(error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

start();
